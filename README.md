# Gmail CRM (Local)

A modern, local-first CRM for bulk sending emails via Gmail SMTP with open tracking and campaign analytics.

## Features

- **Gmail SMTP Integration**: Send emails securely using Google App Passwords.
- **Bulk Contact Import**: Smart parser for pasting data directly from spreadsheets (Excel, Google Sheets).
- **Campaign Management**: Draft campaigns with HTML support and select specific recipients.
- **Analytics Dashboard**: Real-time tracking of sent emails and open rates via tracking pixels.
- **Local Database**: Powered by SQLite - no external database setup required.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup Database**:
   ```bash
   npx prisma db push
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Configure Gmail**:
   - Go to [Settings](http://localhost:3000/settings) in the app.
   - Enter your Gmail address.
   - Generate and enter a [Google App Password](https://myaccount.google.com/apppasswords).
   - Test the connection.

## Usage Guide

### 1. Adding Contacts
Navigate to the **Contacts** tab. Click **Import (Paste Text)** and paste your contact list from a spreadsheet. The system will automatically extract emails and names.

### 2. Creating a Campaign
Go to **Campaigns** -> **New Campaign**. Write your subject and HTML body. Save the draft.

### 3. Sending
Open your draft campaign, select the contacts you want to message, and hit **Send**. The system will send emails with a configured delay to stay within Gmail's limits.

### 4. Tracking
Once sent, the campaign details page will show which recipients have opened the email.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: SQLite + Prisma
- **Email**: Nodemailer
- **UI**: Vanilla CSS (Glassmorphism design)

---
*Note: This application is intended for local use. Standard Gmail accounts have a limit of 500 emails per 24 hours.*
