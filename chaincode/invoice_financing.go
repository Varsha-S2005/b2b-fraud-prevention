package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

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
	Status          string  `json:"status"`
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

func (s *SmartContract) RegisterVendor(ctx contractapi.TransactionContextInterface, id, name, wallet string) error {

	exists, err := ctx.GetStub().GetState(id)
	if err != nil {
		return err
	}
	if exists != nil {
		return fmt.Errorf("vendor already exists")
	}

	vendor := Vendor{id, name, wallet}
	bytes, _ := json.Marshal(vendor)

	return ctx.GetStub().PutState(id, bytes)
}

// ===================== PURCHASE ORDER =====================

func (s *SmartContract) CreatePurchaseOrder(ctx contractapi.TransactionContextInterface, id, vendorId string, amount float64) error {

	if state, _ := ctx.GetStub().GetState(id); state != nil {
		return fmt.Errorf("PO already exists")
	}

	vendorBytes, _ := ctx.GetStub().GetState(vendorId)
	if vendorBytes == nil {
		return fmt.Errorf("vendor not found")
	}

	po := PurchaseOrder{id, vendorId, amount}
	bytes, _ := json.Marshal(po)

	return ctx.GetStub().PutState(id, bytes)
}

// ===================== INVOICE =====================

func (s *SmartContract) UploadInvoice(ctx contractapi.TransactionContextInterface, id, vendorId string, amount float64, poId string) error {

	if state, _ := ctx.GetStub().GetState(id); state != nil {
		return fmt.Errorf("invoice exists")
	}

	// Validate vendor
	vendorBytes, _ := ctx.GetStub().GetState(vendorId)
	if vendorBytes == nil {
		return fmt.Errorf("vendor not found")
	}

	// Validate PO
	poBytes, _ := ctx.GetStub().GetState(poId)
	if poBytes == nil {
		return fmt.Errorf("PO not found")
	}

	var po PurchaseOrder
	json.Unmarshal(poBytes, &po)

	if po.VendorID != vendorId {
		return fmt.Errorf("vendor mismatch with PO")
	}

	invoice := Invoice{
		ID:              id,
		VendorID:        vendorId,
		Amount:          amount,
		Status:          "Pending",
		PurchaseOrderID: poId,
	}

	bytes, _ := json.Marshal(invoice)
	return ctx.GetStub().PutState(id, bytes)
}

// ===================== VERIFY =====================

func (s *SmartContract) VerifyInvoice(ctx contractapi.TransactionContextInterface, invoiceId string) error {

	bytes, _ := ctx.GetStub().GetState(invoiceId)
	if bytes == nil {
		return fmt.Errorf("invoice not found")
	}

	var invoice Invoice
	json.Unmarshal(bytes, &invoice)

	if invoice.Status == "Verified" {
		return fmt.Errorf("already verified")
	}

	poBytes, _ := ctx.GetStub().GetState(invoice.PurchaseOrderID)
	if poBytes == nil {
		return fmt.Errorf("PO not found")
	}

	var po PurchaseOrder
	json.Unmarshal(poBytes, &po)

	if invoice.VendorID != po.VendorID ||
		math.Abs(invoice.Amount-po.Amount) > 0.0001 {
		return fmt.Errorf("3-way match failed")
	}

	invoice.Status = "Verified"
	updated, _ := json.Marshal(invoice)

	ctx.GetStub().SetEvent("InvoiceVerified", updated)
	return ctx.GetStub().PutState(invoiceId, updated)
}

// ===================== PAYMENT =====================

func (s *SmartContract) ProcessPayment(ctx contractapi.TransactionContextInterface, invoiceId, toWallet string) error {

	bytes, _ := ctx.GetStub().GetState(invoiceId)
	if bytes == nil {
		return fmt.Errorf("invoice not found")
	}

	var invoice Invoice
	json.Unmarshal(bytes, &invoice)

	if invoice.Status == "Paid" {
		return fmt.Errorf("already paid")
	}

	if invoice.Status != "Verified" {
		return fmt.Errorf("not verified")
	}

	vendorBytes, _ := ctx.GetStub().GetState(invoice.VendorID)
	if vendorBytes == nil {
		return fmt.Errorf("vendor not found")
	}

	var vendor Vendor
	json.Unmarshal(vendorBytes, &vendor)

	if strings.TrimSpace(strings.ToLower(toWallet)) !=
		strings.TrimSpace(strings.ToLower(vendor.AuthorizedWallet)) {
		return fmt.Errorf("wallet mismatch")
	}

	invoice.Status = "Paid"
	updated, _ := json.Marshal(invoice)

	ctx.GetStub().SetEvent("PaymentProcessed", updated)
	return ctx.GetStub().PutState(invoiceId, updated)
}

// ===================== QUERY =====================

func (s *SmartContract) QueryInvoice(ctx contractapi.TransactionContextInterface, id string) (*Invoice, error) {

	bytes, _ := ctx.GetStub().GetState(id)
	if bytes == nil {
		return nil, fmt.Errorf("not found")
	}

	var invoice Invoice
	json.Unmarshal(bytes, &invoice)

	return &invoice, nil
}

// ===================== MAIN =====================

func main() {
	cc, _ := contractapi.NewChaincode(&SmartContract{})
	cc.Start()
}
