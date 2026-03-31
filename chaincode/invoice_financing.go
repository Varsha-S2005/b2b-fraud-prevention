package main

import (
	"encoding/json"
	"fmt"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
	contractapi.Contract
}

type Invoice struct {
	ID              string  `json:"id"`
	VendorID        string  `json:"vendorId"`
	Amount          float64 `json:"amount"`
	Status          string  `json:"status"` // Verified, Paid, etc.
	PurchaseOrderID string  `json:"purchaseOrderId"`
}

type Vendor struct {
	ID               string `json:"id"`
	AuthorizedWallet string `json:"authorizedWallet"`
}

// 1. Fake Invoice Prevention (3-Way Match)
func (s *SmartContract) UploadInvoice(ctx contractapi.TransactionContextInterface, id string, vendorId string, amount float64, poId string) error {
	// In a real 3-way match, you'd verify against a stored PO here
	invoice := Invoice{ID: id, VendorID: vendorId, Amount: amount, Status: "Verified", PurchaseOrderID: poId}
	invoiceBytes, _ := json.Marshal(invoice)
	return ctx.GetStub().PutState(id, invoiceBytes)
}

// 2. Fund Diversion & 3. Duplicate Disbursement Prevention
func (s *SmartContract) ProcessPayment(ctx contractapi.TransactionContextInterface, invoiceId string, toWallet string) error {
	invoiceBytes, _ := ctx.GetStub().GetState(invoiceId)
	var invoice Invoice
	json.Unmarshal(invoiceBytes, &invoice)

	// Logic: State-Locking (Duplicate Prevention)
	if invoice.Status == "Paid" {
		return fmt.Errorf("ERROR: DUPLICATE DISBURSEMENT PREVENTED - Invoice already paid")
	}

	// Logic: Wallet-Identity Binding (Fund Diversion Prevention)
	vendorBytes, _ := ctx.GetStub().GetState(invoice.VendorID)
	var vendor Vendor
	json.Unmarshal(vendorBytes, &vendor)

	if toWallet != vendor.AuthorizedWallet {
		return fmt.Errorf("ERROR: FUND DIVERSION BLOCKED - Unauthorized Wallet")
	}

	invoice.Status = "Paid"
	newInvoiceBytes, _ := json.Marshal(invoice)
	return ctx.GetStub().PutState(invoiceId, newInvoiceBytes)
}

func main() {
	cc, _ := contractapi.NewChaincode(&SmartContract{})
	cc.Start()
}
