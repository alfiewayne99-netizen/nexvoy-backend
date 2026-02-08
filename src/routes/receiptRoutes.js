/**
 * Receipt Routes
 * Handles receipt and invoice operations
 */

const express = require('express');
const { ReceiptRepository, Receipt } = require('../models/Receipt');
const { PaymentRepository } = require('../models/Payment');
const { BookingRepository } = require('../models/Booking');

function createReceiptRoutes(database = null) {
  const router = express.Router();
  const receiptRepo = new ReceiptRepository(database);
  const paymentRepo = new PaymentRepository(database);
  const bookingRepo = new BookingRepository(database);
  
  /**
   * Get all receipts for user
   * GET /api/receipts
   */
  router.get('/', async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { limit = 50, offset = 0 } = req.query;
      
      const receipts = await receiptRepo.findByUser(userId, { 
        limit: parseInt(limit), 
        offset: parseInt(offset) 
      });
      
      res.json({
        success: true,
        data: receipts.map(r => r.getSummary()),
        meta: {
          total: receipts.length,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Get receipt by ID
   * GET /api/receipts/:id
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const receipt = await receiptRepo.findById(id);
      
      if (!receipt) {
        return res.status(404).json({ success: false, error: 'Receipt not found' });
      }
      
      if (receipt.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      res.json({
        success: true,
        data: receipt.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Get receipt by booking
   * GET /api/receipts/booking/:bookingId
   */
  router.get('/booking/:bookingId', async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      const userId = req.user?.id;
      
      const booking = await bookingRepo.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      const receipt = await receiptRepo.findByBooking(bookingId);
      
      if (!receipt) {
        return res.status(404).json({ success: false, error: 'Receipt not found for this booking' });
      }
      
      res.json({
        success: true,
        data: receipt.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Get receipt PDF
   * GET /api/receipts/:id/pdf
   */
  router.get('/:id/pdf', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const receipt = await receiptRepo.findById(id);
      
      if (!receipt) {
        return res.status(404).json({ success: false, error: 'Receipt not found' });
      }
      
      if (receipt.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Generate HTML for PDF
      const html = generateReceiptHTML(receipt);
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`);
      
      // Return HTML for now (in production, convert to PDF using puppeteer or similar)
      res.send(html);
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Resend receipt email
   * POST /api/receipts/:id/resend
   */
  router.post('/:id/resend', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { email } = req.body;
      
      const receipt = await receiptRepo.findById(id);
      
      if (!receipt) {
        return res.status(404).json({ success: false, error: 'Receipt not found' });
      }
      
      if (receipt.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      const emailService = require('../services/emailService');
      
      await emailService.sendEmail({
        to: email || receipt.buyer.email,
        subject: `Receipt - ${receipt.receiptNumber}`,
        html: generateReceiptHTML(receipt)
      });
      
      res.json({
        success: true,
        message: 'Receipt resent successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  return router;
}

/**
 * Generate receipt HTML
 */
function generateReceiptHTML(receipt) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: receipt.currency
    }).format(amount);
  };
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt ${receipt.receiptNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #667eea; }
        .receipt-title { font-size: 24px; margin: 20px 0; }
        .info-grid { display: flex; justify-content: space-between; margin: 30px 0; }
        .info-box { flex: 1; }
        .info-box h3 { color: #667eea; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 30px 0; }
        th { background: #667eea; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #ddd; }
        .text-right { text-align: right; }
        .totals { margin-top: 30px; border-top: 2px solid #667eea; padding-top: 20px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .grand-total { font-size: 24px; font-weight: bold; color: #667eea; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
        .status-paid { background: #22c55e; color: white; }
        .status-pending { background: #f59e0b; color: white; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">NEXVOY</div>
        <div class="receipt-title">${receipt.type === 'invoice' ? 'INVOICE' : 'RECEIPT'}</div>
        <span class="status-badge status-${receipt.status}">${receipt.status.toUpperCase()}</span>
      </div>
      
      <div class="info-grid">
        <div class="info-box">
          <h3>From</h3>
          <p><strong>${receipt.seller.name}</strong></p>
          <p>${receipt.seller.address.street}</p>
          <p>${receipt.seller.address.city}, ${receipt.seller.address.state} ${receipt.seller.address.postalCode}</p>
          <p>${receipt.seller.email}</p>
        </div>
        <div class="info-box">
          <h3>Receipt Details</h3>
          <p><strong>Number:</strong> ${receipt.receiptNumber}</p>
          <p><strong>Date:</strong> ${new Date(receipt.issueDate).toLocaleDateString()}</p>
          <p><strong>Payment Method:</strong> ${receipt.payment.method || 'N/A'}</p>
          ${receipt.payment.transactionId ? `<p><strong>Transaction ID:</strong> ${receipt.payment.transactionId}</p>` : ''}
        </div>
        <div class="info-box">
          <h3>Bill To</h3>
          <p><strong>${receipt.buyer.name}</strong></p>
          <p>${receipt.buyer.email}</p>
          ${receipt.buyer.address?.street ? `<p>${receipt.buyer.address.street}</p>` : ''}
          ${receipt.buyer.address?.city ? `<p>${receipt.buyer.address.city}, ${receipt.buyer.address.state || ''} ${receipt.buyer.address.postalCode || ''}</p>` : ''}
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${receipt.items.map(item => `
            <tr>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unitPrice)}</td>
              <td class="text-right">${formatCurrency(item.totalPrice)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(receipt.subtotal)}</span>
        </div>
        ${receipt.discount > 0 ? `
          <div class="total-row">
            <span>Discount:</span>
            <span>-${formatCurrency(receipt.discount)}</span>
          </div>
        ` : ''}
        <div class="total-row">
          <span>Tax:</span>
          <span>${formatCurrency(receipt.taxes)}</span>
        </div>
        <div class="total-row grand-total">
          <span>TOTAL:</span>
          <span>${formatCurrency(receipt.total)}</span>
        </div>
      </div>
      
      ${receipt.notes ? `
        <div style="margin-top: 30px;">
          <h3>Notes</h3>
          <p>${receipt.notes}</p>
        </div>
      ` : ''}
      
      <div class="footer">
        <p>Thank you for choosing Nexvoy!</p>
        <p>If you have any questions, please contact us at support@nexvoy.com</p>
      </div>
    </body>
    </html>
  `;
}

module.exports = createReceiptRoutes;
