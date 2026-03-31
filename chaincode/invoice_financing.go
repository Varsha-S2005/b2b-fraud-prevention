package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
	contractapi.Contract
}

// ===================== STRUCTS =====================

type Invoice struct {
	ID              string  `json:"id"`
	VendorID        string  `json:"vendorId"`
	Amount          float64 `json:"amount"`
	Status          string  `json:"status"` // Pending, Verified, Paid
	PurchaseOrderID string  `json:"purchaseOrderId"`
}

type Vendor struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	AuthorizedWallet string `json:"authorizedWallet"`
}

type PurchaseOrder struct {
	ID       string  `json:"id"`
	VendorID string  `json:"vendorId"`
	Amount   float64 `json:"amount"`
}

// ===================== VENDOR =====================

// Wallet-Identity Binding
func (s *SmartContract) RegisterVendor(ctx contractapi.TransactionContextInterface, id string, name string, wallet string) error {

	exists, err := ctx.GetStub().GetState(id)
	if err != nil {
		return err
	}
	if exists != nil {
		return fmt.Errorf("vendor %s already exists", id)
	}

	vendor := Vendor{
		ID:               id,
		Name:             name,
		AuthorizedWallet: wallet,
	}

	vendorBytes, err := json.Marshal(vendor)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, vendorBytes)
}

// ===================== PURCHASE ORDER =====================

func (s *SmartContract) CreatePurchaseOrder(ctx contractapi.TransactionContextInterface, id string, vendorId string, amount float64) error {

	exists, err := ctx.GetStub().GetState(id)
	if err != nil {
		return err
	}
	if exists != nil {
		return fmt.Errorf("PO %s already exists", id)
	}

	// Ensure vendor exists
	vendorBytes, err := ctx.GetStub().GetState(vendorId)
	if err != nil || vendorBytes == nil {
		return fmt.Errorf("vendor not found")
	}

	po := PurchaseOrder{
		ID:       id,
		VendorID: vendorId,
		Amount:   amount,
	}

	poBytes, err := json.Marshal(po)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, poBytes)
}

// ===================== INVOICE =====================

// Upload → Pending (NOT verified yet)
func (s *SmartContract) UploadInvoice(ctx contractapi.TransactionContextInterface, id string, vendorId string, amount float64, poId string) error {

	exists, err := ctx.GetStub().GetState(id)
	if err != nil {
		return err
	}
	if exists != nil {
		return fmt.Errorf("invoice %s already exists", id)
	}

	invoice := Invoice{
		ID:              id,
		VendorID:        vendorId,
		Amount:          amount,
		Status:          "Pending",
		PurchaseOrderID: poId,
	}

	invoiceBytes, err := json.Marshal(invoice)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, invoiceBytes)
}

// ===================== 3-WAY MATCH =====================

// Buyer verifies invoice
func (s *SmartContract) VerifyInvoice(ctx contractapi.TransactionContextInterface, invoiceId string) error {

	invoiceBytes, err := ctx.GetStub().GetState(invoiceId)
	if err != nil || invoiceBytes == nil {
		return fmt.Errorf("invoice not found")
	}

	var invoice Invoice
	err = json.Unmarshal(invoiceBytes, &invoice)
	if err != nil {
		return err
	}

	// Get PO
	poBytes, err := ctx.GetStub().GetState(invoice.PurchaseOrderID)
	if err != nil || poBytes == nil {
		return fmt.Errorf("purchase order not found")
	}

	var po PurchaseOrder
	err = json.Unmarshal(poBytes, &po)
	if err != nil {
		return err
	}

	// 🔥 3-WAY MATCH LOGIC
	if invoice.VendorID != po.VendorID || invoice.Amount != po.Amount {
		return fmt.Errorf("3-Way Match Failed: Invoice does not match PO")
	}

	invoice.Status = "Verified"

	updatedBytes, err := json.Marshal(invoice)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(invoiceId, updatedBytes)
	if err != nil {
		return err
	}

	// Event for audit
	ctx.GetStub().SetEvent("InvoiceVerified", updatedBytes)

	return nil
}

// ===================== PAYMENT =====================

func (s *SmartContract) ProcessPayment(ctx contractapi.TransactionContextInterface, invoiceId string, toWallet string) error {

	invoiceBytes, err := ctx.GetStub().GetState(invoiceId)
	if err != nil || invoiceBytes == nil {
		return fmt.Errorf("invoice not found")
	}

	var invoice Invoice
	err = json.Unmarshal(invoiceBytes, &invoice)
	if err != nil {
		return err
	}

	// ❌ Prevent duplicate payment
	if invoice.Status == "Paid" {
		return fmt.Errorf("CRITICAL: invoice already paid")
	}

	// ❌ Ensure invoice is verified
	if invoice.Status != "Verified" {
		return fmt.Errorf("invoice not verified")
	}

	// Get vendor
	vendorBytes, err := ctx.GetStub().GetState(invoice.VendorID)
	if err != nil || vendorBytes == nil {
		return fmt.Errorf("vendor not found")
	}

	var vendor Vendor
	err = json.Unmarshal(vendorBytes, &vendor)
	if err != nil {
		return err
	}

	// 🔥 Wallet Binding Check
	if toWallet != vendor.AuthorizedWallet {
		return fmt.Errorf("FRAUD ALERT: wallet mismatch")
	}

	// ✅ Mark as paid
	invoice.Status = "Paid"

	updatedBytes, err := json.Marshal(invoice)
	if err != nil {
		return err
	}

	err = ctx.GetStub().PutState(invoiceId, updatedBytes)
	if err != nil {
		return err
	}

	// 🔥 Event logging (audit trail)
	ctx.GetStub().SetEvent("PaymentProcessed", updatedBytes)

	return nil
}

// ===================== QUERY =====================

func (s *SmartContract) QueryInvoice(ctx contractapi.TransactionContextInterface, id string) (*Invoice, error) {

	invoiceBytes, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, err
	}
	if invoiceBytes == nil {
		return nil, fmt.Errorf("invoice not found")
	}

	var invoice Invoice
	err = json.Unmarshal(invoiceBytes, &invoice)
	if err != nil {
		return nil, err
	}

	return &invoice, nil
}

// ===================== MAIN =====================

func main() {
	cc, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating chaincode: %s", err.Error())
		return
	}

	if err := cc.Start(); err != nil {
		fmt.Printf("Error starting chaincode: %s", err.Error())
	}
}
