/**
 * Email Service
 * 
 * Supports multiple email providers:
 * - SendGrid (preferred, via @sendgrid/mail)
 * - Nodemailer (fallback, for SMTP)
 * - Development mode: console.log fallback
 * 
 * Environment variables:
 * - EMAIL_PROVIDER: 'sendgrid' | 'nodemailer' | 'console' (default: 'console')
 * - SENDGRID_API_KEY: SendGrid API key (required for SendGrid)
 * - SENDGRID_FROM_EMAIL: Sender email address (required for SendGrid)
 * - SMTP_HOST: SMTP host (required for nodemailer)
 * - SMTP_PORT: SMTP port (required for nodemailer)
 * - SMTP_USER: SMTP username (required for nodemailer)
 * - SMTP_PASS: SMTP password (required for nodemailer)
 * - SMTP_FROM: Sender email address (required for nodemailer)
 */

class EmailService {
    constructor() {
        this.provider = process.env.EMAIL_PROVIDER || 'console';
        this.sendgridClient = null;
        this.nodemailerTransporter = null;
        this.initialized = false;
    }

    /**
     * Initialize the email service based on provider
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            switch (this.provider.toLowerCase()) {
                case 'sendgrid':
                    await this._initializeSendGrid();
                    break;
                case 'nodemailer':
                    await this._initializeNodemailer();
                    break;
                case 'console':
                default:
                    // Console mode - no initialization needed
                    if (process.env.NODE_ENV === 'production') {
                        console.warn('⚠️  Email service is in console mode. Emails will not be sent in production!');
                    }
                    break;
            }
            this.initialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize email service:', error.message);
            // Fallback to console mode
            this.provider = 'console';
            this.initialized = true;
        }
    }

    /**
     * Initialize SendGrid client
     */
    async _initializeSendGrid() {
        try {
            const sgMail = require('@sendgrid/mail');
            
            if (!process.env.SENDGRID_API_KEY) {
                throw new Error('SENDGRID_API_KEY environment variable is required for SendGrid');
            }
            
            if (!process.env.SENDGRID_FROM_EMAIL) {
                throw new Error('SENDGRID_FROM_EMAIL environment variable is required for SendGrid');
            }

            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.sendgridClient = sgMail;
            
            console.log('✅ SendGrid email service initialized');
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error('@sendgrid/mail package not installed. Run: npm install @sendgrid/mail');
            }
            throw error;
        }
    }

    /**
     * Initialize Nodemailer transporter
     */
    async _initializeNodemailer() {
        try {
            const nodemailer = require('nodemailer');
            
            const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
            const missingVars = requiredVars.filter(varName => !process.env[varName]);
            
            if (missingVars.length > 0) {
                throw new Error(`Missing required environment variables for nodemailer: ${missingVars.join(', ')}`);
            }

            this.nodemailerTransporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT, 10),
                secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            // Verify connection
            await this.nodemailerTransporter.verify();
            
            console.log('✅ Nodemailer email service initialized');
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error('nodemailer package not installed. Run: npm install nodemailer');
            }
            throw error;
        }
    }

    /**
     * Send password reset email
     * @param {string} to - Recipient email address
     * @param {string} resetUrl - Password reset URL with token
     * @returns {Promise<boolean>} - Success status
     */
    async sendPasswordResetEmail(to, resetUrl) {
        await this.initialize();

        const subject = 'Reset Your Password - Flight Match Finder';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reset Your Password</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #007AFF; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">Flight Match Finder</h1>
                </div>
                <div style="background-color: #FFFFFF; padding: 30px; border: 1px solid #E0E0E0; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="display: inline-block; background-color: #007AFF; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Reset Password
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                    <p style="color: #007AFF; font-size: 12px; word-break: break-all; background-color: #F5F5F5; padding: 10px; border-radius: 4px;">${resetUrl}</p>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        <strong>This link will expire in 10 minutes.</strong>
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                    </p>
                    <hr style="border: none; border-top: 1px solid #E0E0E0; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                        © ${new Date().getFullYear()} Flight Match Finder. All rights reserved.
                    </p>
                </div>
            </body>
            </html>
        `;
        const text = `
Reset Your Password - Flight Match Finder

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 10 minutes.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

© ${new Date().getFullYear()} Flight Match Finder. All rights reserved.
        `.trim();

        return await this._sendEmail(to, subject, html, text);
    }

    /**
     * Internal method to send email using the configured provider
     * @private
     */
    async _sendEmail(to, subject, html, text) {
        await this.initialize();

        try {
            switch (this.provider.toLowerCase()) {
                case 'sendgrid':
                    return await this._sendViaSendGrid(to, subject, html, text);
                case 'nodemailer':
                    return await this._sendViaNodemailer(to, subject, html, text);
                case 'console':
                default:
                    return await this._sendViaConsole(to, subject, html, text);
            }
        } catch (error) {
            console.error('❌ Error sending email:', error);
            // In production, we might want to log to a service like Sentry
            // For now, we'll return false to indicate failure
            return false;
        }
    }

    /**
     * Send email via SendGrid
     * @private
     */
    async _sendViaSendGrid(to, subject, html, text) {
        if (!this.sendgridClient) {
            throw new Error('SendGrid client not initialized');
        }

        const fromEmail = process.env.SENDGRID_FROM_EMAIL;
        
        const msg = {
            to,
            from: fromEmail,
            subject,
            text,
            html,
        };

        await this.sendgridClient.send(msg);
        console.log(`✅ Password reset email sent to ${to} via SendGrid`);
        return true;
    }

    /**
     * Send email via Nodemailer
     * @private
     */
    async _sendViaNodemailer(to, subject, html, text) {
        if (!this.nodemailerTransporter) {
            throw new Error('Nodemailer transporter not initialized');
        }

        const fromEmail = process.env.SMTP_FROM;
        
        const mailOptions = {
            from: fromEmail,
            to,
            subject,
            text,
            html,
        };

        await this.nodemailerTransporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to ${to} via Nodemailer`);
        return true;
    }

    /**
     * Log email to console (development mode)
     * @private
     */
    async _sendViaConsole(to, subject, html, text) {
        console.log('\n📧 ===== EMAIL (Console Mode) =====');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('\n--- Text Version ---');
        console.log(text);
        console.log('\n--- HTML Version ---');
        console.log(html);
        console.log('=====================================\n');
        
        if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️  WARNING: Email service is in console mode in production!');
        }
        
        return true;
    }
}

// Export singleton instance
module.exports = new EmailService();


