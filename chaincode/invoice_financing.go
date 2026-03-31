/*
 SPDX-License-Identifier: Apache-2.0
*/

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
	contractapi.Contract
}

// Invoice remains the core asset
type Invoice struct {
	InvoiceID         string `json:"invoiceId"`
	Vendor            string `json:"vendor"`
	Buyer             string `json:"buyer"`
	Amount            string `json:"amount"`
	PurchaseOrderID   string `json:"purchaseOrderId"`
	DeliveryProofHash string `json:"deliveryProofHash"`
	Status            string `json:"status"`
	SystemValidated   bool   `json:"systemValidated"`
	BuyerApproved     bool   `json:"buyerApproved"`
	Timestamp         string `json:"timestamp"`
	CreatorID         string `json:"creatorId"`
	LastModifiedBy    string `json:"lastModifiedBy"`
	Signature         string `json:"signature"`
}

type PurchaseOrder struct {
	POID      string `json:"poId"`
	Vendor    string `json:"vendor"`
	Buyer     string `json:"buyer"`
	Amount    string `json:"amount"`
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

type Vendor struct {
	VendorID          string `json:"vendorId"`
	Name              string `json:"name"`
	Status            string `json:"status"`
	MaxLimit          string `json:"maxLimit"`
	Registered        string `json:"registered"`
	AuthorizedWallet  string `json:"authorizedWallet"` // CRITICAL: Used for Wallet Verification
	CertifiedIdentity bool   `json:"certifiedIdentity"`
}

type Payment struct {
	PaymentID string `json:"paymentId"`
	InvoiceID string `json:"invoiceId"`
	Vendor    string `json:"vendor"`
	Amount    string `json:"amount"`
	ToWallet  string `json:"toWallet"`
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

const (
	StatusSubmitted = "SUBMITTED"
	StatusValidated = "VALIDATED" // System + PO match
	StatusApproved  = "APPROVED"  // Buyer clicked 'Verify' in your diagram
	StatusPaid      = "PAID"      // Final state after ProcessPayment
	StatusRejected  = "REJECTED"
	POStatusActive  = "ACTIVE"
	VendorStatusActive = "ACTIVE"
	PaymentStatusCompleted = "COMPLETED"
)

// --- CORE LOGIC FUNCTIONS ---

func (s *SmartContract) CreateInvoice(ctx contractapi.TransactionContextInterface, invoiceId string, vendor string, buyer string, amount string, purchaseOrderId string, deliveryProofHash string) error {
	exists, err := s.InvoiceExists(ctx, invoiceId)
	if err != nil || exists {
		return fmt.Errorf("invoice already exists or error checking: %v", err)
	}

	// 1. Cross-check with Purchase Order (Matches "Details Match?" in flowchart)
	po, err := s.ReadPurchaseOrder(ctx, purchaseOrderId)
	if err != nil || po.Status != POStatusActive || amount != po.Amount {
		return fmt.Errorf("MISREPORTING ERROR: Invoice does not match active PO")
	}

	clientID, _ := ctx.GetClientIdentity().GetID()
	invoice := Invoice{
		InvoiceID:         invoiceId,
		Vendor:            vendor,
		Buyer:             buyer,
		Amount:            amount,
		PurchaseOrderID:   purchaseOrderId,
		DeliveryProofHash: deliveryProofHash,
		Status:            StatusSubmitted,
		SystemValidated:   true, 
		BuyerApproved:     false,
		Timestamp:         time.Now().Format(time.RFC3339),
		CreatorID:         clientID,
	}

	invoiceJSON, _ := json.Marshal(invoice)
	return ctx.GetStub().PutState(invoiceId, invoiceJSON)
}

// VerifyInvoice corresponds to "Verify Invoice" actor action in your Use Case
func (s *SmartContract) VerifyInvoice(ctx contractapi.TransactionContextInterface, invoiceId string) error {
	invoice, err := s.ReadInvoice(ctx, invoiceId)
	if err != nil || invoice.Status != StatusSubmitted {
		return fmt.Errorf("invoice not ready for verification")
	}

	invoice.Status = StatusApproved // Set to Approved instead of "Validated" to clear for P2P payment
	invoice.BuyerApproved = true
	invoice.Timestamp = time.Now().Format(time.RFC3339)

	invoiceJSON, _ := json.Marshal(invoice)
	return ctx.GetStub().PutState(invoiceId, invoiceJSON)
}

// ProcessPayment corresponds to "Initiate Payment" + "Verify Registered Wallet"
func (s *SmartContract) ProcessPayment(ctx contractapi.TransactionContextInterface, paymentId string, invoiceId string, toWallet string) error {
	invoice, err := s.ReadInvoice(ctx, invoiceId)
	if err != nil || invoice.Status != StatusApproved {
		return fmt.Errorf("invoice %s is not approved for payment", invoiceId)
	}

	vendor, err := s.ReadVendor(ctx, invoice.Vendor)
	if err != nil {
		return fmt.Errorf("vendor record not found")
	}

	// 2. WALLET VERIFICATION: Prevents Fund Diversion
	if toWallet != vendor.AuthorizedWallet {
		return fmt.Errorf("FUND DIVERSION BLOCKED: Wallet %s is not authorized", toWallet)
	}

	// 3. DOUBLE DISBURSEMENT PREVENTION: Change state immediately
	invoice.Status = StatusPaid
	invoiceJSON, _ := json.Marshal(invoice)
	ctx.GetStub().PutState(invoiceId, invoiceJSON)

	// 4. RECORD TRANSACTION: Create the Immutable Record
	payment := Payment{
		PaymentID: paymentId,
		InvoiceID: invoiceId,
		Vendor:    invoice.Vendor,
		Amount:    invoice.Amount,
		ToWallet:  toWallet,
		Status:    PaymentStatusCompleted,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	paymentJSON, _ := json.Marshal(payment)
	return ctx.GetStub().PutState("PAYMENT_"+paymentId, paymentJSON)
}

// --- HELPER FUNCTIONS ---

func (s *SmartContract) RegisterVendor(ctx contractapi.TransactionContextInterface, vendorId string, name string, maxLimit string, authorizedWallet string) error {
	vendor := Vendor{
		VendorID:         vendorId,
		Name:             name,
		Status:           VendorStatusActive,
		MaxLimit:         maxLimit,
		Registered:       time.Now().Format(time.RFC3339),
		AuthorizedWallet: authorizedWallet,
		CertifiedIdentity: true,
	}
	vendorJSON, _ := json.Marshal(vendor)
	return ctx.GetStub().PutState("VENDOR_"+vendorId, vendorJSON)
}

func (s *SmartContract) CreatePurchaseOrder(ctx contractapi.TransactionContextInterface, poId string, vendor string, buyer string, amount string) error {
	po := PurchaseOrder{
		POID: poId, Vendor: vendor, Buyer: buyer, Amount: amount, Status: POStatusActive, Timestamp: time.Now().Format(time.RFC3339),
	}
	poJSON, _ := json.Marshal(po)
	return ctx.GetStub().PutState("PO_"+poId, poJSON)
}

func (s *SmartContract) ReadInvoice(ctx contractapi.TransactionContextInterface, invoiceId string) (*Invoice, error) {
	invoiceJSON, _ := ctx.GetStub().GetState(invoiceId)
	if invoiceJSON == nil { return nil, fmt.Errorf("not found") }
	var invoice Invoice
	json.Unmarshal(invoiceJSON, &invoice)
	return &invoice, nil
}

func (s *SmartContract) ReadVendor(ctx contractapi.TransactionContextInterface, vendorId string) (*Vendor, error) {
	vendorJSON, _ := ctx.GetStub().GetState("VENDOR_" + vendorId)
	if vendorJSON == nil { return nil, fmt.Errorf("not found") }
	var vendor Vendor
	json.Unmarshal(vendorJSON, &vendor)
	return &vendor, nil
}

func (s *SmartContract) InvoiceExists(ctx contractapi.TransactionContextInterface, invoiceId string) (bool, error) {
	invoiceJSON, _ := ctx.GetStub().GetState(invoiceId)
	return invoiceJSON != nil, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil { log.Panicf("Error creating chaincode: %v", err) }
	if err := chaincode.Start(); err != nil { log.Panicf("Error starting chaincode: %v", err) }
}
