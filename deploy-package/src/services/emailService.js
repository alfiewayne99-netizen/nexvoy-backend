/**
 * Email Service
 * Handles all email notifications for bookings, payments, and alerts
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Support for multiple email providers
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
    
    switch (emailProvider) {
      case 'sendgrid':
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
        break;
      
      case 'mailgun':
        this.transporter = nodemailer.createTransport({
          host: 'smtp.mailgun.org',
          port: 587,
          auth: {
            user: process.env.MAILGUN_USER,
            pass: process.env.MAILGUN_PASS
          }
        });
        break;
      
      case 'ses':
        this.transporter = nodemailer.createTransport({
          host: 'email-smtp.us-east-1.amazonaws.com',
          port: 587,
          auth: {
            user: process.env.AWS_SES_USER,
            pass: process.env.AWS_SES_PASS
          }
        });
        break;
      
      case 'smtp':
      default:
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        break;
    }
  }

  /**
   * Send email
   */
  async sendEmail({ to, subject, html, text = null, attachments = [], from = null }) {
    try {
      const mailOptions = {
        from: from || process.env.EMAIL_FROM || 'Nexvoy <bookings@nexvoy.com>',
        to,
        subject,
        html
      };

      if (text) mailOptions.text = text;
      if (attachments.length > 0) mailOptions.attachments = attachments;

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(booking, payment, user) {
    const subject = `Your Nexvoy Booking Confirmation - ${booking.bookingReference}`;
    
    const html = this.generateBookingConfirmationHTML(booking, payment, user);
    const text = this.generateBookingConfirmationText(booking, payment, user);

    return this.sendEmail({
      to: booking.contact.email,
      subject,
      html,
      text
    });
  }

  /**
   * Send e-ticket email
   */
  async sendETicket(booking, user) {
    const subject = `Your E-Ticket - ${booking.bookingReference}`;
    
    const html = this.generateETicketHTML(booking, user);
    const text = this.generateETicketText(booking, user);

    // Generate PDF attachment (simplified - in production would use PDF generation)
    const attachments = [{
      filename: `ticket-${booking.bookingReference}.pdf`,
      content: 'PDF_CONTENT_PLACEHOLDER', // Would be actual PDF buffer
      contentType: 'application/pdf'
    }];

    return this.sendEmail({
      to: booking.contact.email,
      subject,
      html,
      text,
      attachments
    });
  }

  /**
   * Send payment receipt
   */
  async sendPaymentReceipt(payment, booking, user) {
    const subject = `Payment Receipt - ${booking.bookingReference}`;
    
    const html = this.generatePaymentReceiptHTML(payment, booking, user);
    const text = this.generatePaymentReceiptText(payment, booking, user);

    return this.sendEmail({
      to: booking.contact.email,
      subject,
      html,
      text
    });
  }

  /**
   * Send refund confirmation
   */
  async sendRefundConfirmation(payment, booking, refundAmount) {
    const subject = `Refund Confirmation - ${booking.bookingReference}`;
    
    const html = this.generateRefundConfirmationHTML(payment, booking, refundAmount);
    const text = this.generateRefundConfirmationText(payment, booking, refundAmount);

    return this.sendEmail({
      to: booking.contact.email,
      subject,
      html,
      text
    });
  }

  /**
   * Send price alert notification
   */
  async sendPriceAlert(alert, currentPrice, previousPrice) {
    const subject = `🔥 Price Drop Alert! ${alert.origin} to ${alert.destination}`;
    
    const savings = previousPrice - currentPrice;
    const savingsPercent = ((savings / previousPrice) * 100).toFixed(1);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">✈️ Price Drop Alert!</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <h2 style="color: #333;">Great news! Prices have dropped!</h2>
          <p>We've detected a price drop on your watched route:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">${alert.origin} → ${alert.destination}</h3>
            <p><strong>Dates:</strong> ${new Date(alert.departureDate).toLocaleDateString()} - ${alert.returnDate ? new Date(alert.returnDate).toLocaleDateString() : 'One way'}</p>
            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
              <div style="text-align: center;">
                <p style="color: #999; text-decoration: line-through; font-size: 18px;">$${previousPrice}</p>
                <p style="color: #22c55e; font-size: 28px; font-weight: bold; margin: 5px 0;">$${currentPrice}</p>
              </div>
              <div style="background: #22c55e; color: white; padding: 15px 25px; border-radius: 25px; display: flex; align-items: center;">
                <span style="font-size: 20px; font-weight: bold;">Save ${savingsPercent}%</span>
              </div>
            </div>
          </div>
          <a href="${process.env.FRONTEND_URL}/search?origin=${alert.origin}&destination=${alert.destination}&departure=${alert.departureDate}&return=${alert.returnDate || ''}" 
             style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
            Book Now
          </a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            You're receiving this because you set a price alert on Nexvoy. 
            <a href="${process.env.FRONTEND_URL}/alerts">Manage your alerts</a>
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: alert.email,
      subject,
      html
    });
  }

  /**
   * Send itinerary sharing email
   */
  async sendItineraryShare(itinerary, recipientEmail, shareLink, senderName) {
    const subject = `${senderName} shared a trip itinerary with you!`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">🗺️ Trip Itinerary Shared</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 16px;"><strong>${senderName}</strong> has shared a trip itinerary with you!</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">${itinerary.title}</h3>
            <p>${itinerary.destination}</p>
            <p><strong>${itinerary.days.length} days</strong> • ${itinerary.days.reduce((sum, d) => sum + d.activities.length, 0)} activities</p>
          </div>
          <a href="${shareLink}" 
             style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
            View Itinerary
          </a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            Powered by Nexvoy - Your AI Travel Companion
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html
    });
  }

  /**
   * Send proactive AI suggestion
   */
  async sendProactiveSuggestion(user, suggestion) {
    const subject = suggestion.title;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">✨ ${suggestion.icon || '💡'} Nex has a suggestion for you!</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <h2 style="color: #333;">${suggestion.title}</h2>
          <p style="font-size: 16px; line-height: 1.6;">${suggestion.message}</p>
          ${suggestion.actionUrl ? `
            <a href="${suggestion.actionUrl}" 
               style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
              ${suggestion.actionText || 'Learn More'}
            </a>
          ` : ''}
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            You're receiving this because you enabled proactive suggestions from Nex.
            <a href="${process.env.FRONTEND_URL}/settings/notifications">Manage preferences</a>
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  // HTML Template Generators
  generateBookingConfirmationHTML(booking, payment, user) {
    const getBookingDetails = () => {
      if (booking.type === 'flight' && booking.flightDetails) {
        const flight = booking.flightDetails;
        return `
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">✈️ Flight Details</h3>
            <p><strong>${flight.outbound.airline}</strong> - ${flight.outbound.flightNumber}</p>
            <p>${flight.outbound.departure.airport} (${flight.outbound.departure.airportCode}) 
               → ${flight.outbound.arrival.airport} (${flight.outbound.arrival.airportCode})</p>
            <p><strong>Departure:</strong> ${new Date(flight.outbound.departure.datetime).toLocaleString()}</p>
            <p><strong>Passengers:</strong> ${flight.passengers?.length || 1}</p>
          </div>
        `;
      } else if (booking.type === 'hotel' && booking.hotelDetails) {
        const hotel = booking.hotelDetails;
        return `
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">🏨 Hotel Details</h3>
            <p><strong>${hotel.propertyName}</strong></p>
            <p>${hotel.address.city}, ${hotel.address.country}</p>
            <p><strong>Check-in:</strong> ${new Date(hotel.checkIn).toLocaleDateString()}</p>
            <p><strong>Check-out:</strong> ${new Date(hotel.checkOut).toLocaleDateString()}</p>
            <p><strong>Nights:</strong> ${hotel.nights}</p>
          </div>
        `;
      }
      return '';
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">Booking Confirmed! 🎉</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 16px;">Hi ${user.name || 'there'},</p>
          <p style="font-size: 16px;">Your booking has been confirmed! Here are your booking details:</p>
          
          <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;">Booking Reference</p>
            <p style="margin: 10px 0; font-size: 32px; font-weight: bold; letter-spacing: 2px;">${booking.bookingReference}</p>
          </div>
          
          ${getBookingDetails()}
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">💳 Payment Summary</h3>
            <p><strong>Total Paid:</strong> $${booking.pricing.total.toFixed(2)} ${booking.pricing.currency}</p>
            <p><strong>Payment Method:</strong> ${payment.method}</p>
            <p><strong>Status:</strong> Confirmed ✅</p>
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            You can view and manage your booking anytime by logging into your Nexvoy account.
          </p>
          
          <a href="${process.env.FRONTEND_URL}/bookings/${booking.id}" 
             style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
            View Booking
          </a>
          
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            Need help? Contact us at support@nexvoy.com
          </p>
        </div>
      </div>
    `;
  }

  generateBookingConfirmationText(booking, payment, user) {
    return `
      Booking Confirmed!
      
      Hi ${user.name || 'there'},
      
      Your booking has been confirmed!
      
      Booking Reference: ${booking.bookingReference}
      Total Paid: $${booking.pricing.total.toFixed(2)} ${booking.pricing.currency}
      Status: Confirmed
      
      View your booking: ${process.env.FRONTEND_URL}/bookings/${booking.id}
      
      Need help? Contact us at support@nexvoy.com
    `;
  }

  generateETicketHTML(booking, user) {
    const flight = booking.flightDetails;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">Your E-Ticket ✈️</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 16px;">Hi ${user.name || 'there'},</p>
          <p style="font-size: 16px;">Your e-ticket is attached to this email. Please save it and present it at check-in.</p>
          
          <div style="border: 2px dashed #667eea; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">Flight Summary</h3>
            <p><strong>${flight.outbound.airline} ${flight.outbound.flightNumber}</strong></p>
            <p>${new Date(flight.outbound.departure.datetime).toLocaleString()}</p>
            <p>${flight.outbound.departure.airport} (${flight.outbound.departure.airportCode}) → ${flight.outbound.arrival.airport} (${flight.outbound.arrival.airportCode})</p>
            <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
          </div>
        </div>
      </div>
    `;
  }

  generateETicketText(booking, user) {
    return `Your E-Ticket is attached. Booking Reference: ${booking.bookingReference}`;
  }

  generatePaymentReceiptHTML(payment, booking, user) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">Payment Receipt 🧾</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 16px;">Hi ${user.name || 'there'},</p>
          <p style="font-size: 16px;">Thank you for your payment. Here is your receipt:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
            <p><strong>Amount:</strong> $${payment.amount.toFixed(2)} ${payment.currency}</p>
            <p><strong>Payment Method:</strong> ${payment.method}</p>
            <p><strong>Date:</strong> ${new Date(payment.completedAt).toLocaleString()}</p>
            ${payment.receiptNumber ? `<p><strong>Receipt #:</strong> ${payment.receiptNumber}</p>` : ''}
          </div>
          
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            This receipt was generated by Nexvoy. For questions, contact support@nexvoy.com
          </p>
        </div>
      </div>
    `;
  }

  generatePaymentReceiptText(payment, booking, user) {
    return `
      Payment Receipt
      
      Booking Reference: ${booking.bookingReference}
      Amount: $${payment.amount.toFixed(2)} ${payment.currency}
      Payment Method: ${payment.method}
      Date: ${new Date(payment.completedAt).toLocaleString()}
      ${payment.receiptNumber ? `Receipt #: ${payment.receiptNumber}` : ''}
    `;
  }

  generateRefundConfirmationHTML(payment, booking, refundAmount) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">Refund Confirmation 💸</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p style="font-size: 16px;">Your refund has been processed successfully.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
            <p><strong>Refund Amount:</strong> $${refundAmount.toFixed(2)}</p>
            <p><strong>Original Payment:</strong> $${payment.amount.toFixed(2)}</p>
            <p><strong>Status:</strong> Processed ✅</p>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            Refunds typically take 5-10 business days to appear on your statement depending on your payment method and bank.
          </p>
        </div>
      </div>
    `;
  }

  generateRefundConfirmationText(payment, booking, refundAmount) {
    return `
      Refund Confirmation
      
      Booking Reference: ${booking.bookingReference}
      Refund Amount: $${refundAmount.toFixed(2)}
      Status: Processed
      
      Refunds typically take 5-10 business days to appear.
    `;
  }
}

// Export singleton instance
module.exports = new EmailService();
module.exports.EmailService = EmailService;
