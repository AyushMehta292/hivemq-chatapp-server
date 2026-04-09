# HiveMQ Chat API (Server)

Backend for the MERN chat app: Express, MongoDB, JWT auth with email verification, HiveMQ MQTT for real-time messages, and Cloudinary for file uploads.

## Setup

1. Copy `.env.example` to `.env` and set your credentials (MongoDB, JWT, Cloudinary, HiveMQ, SMTP).
2. Install and run:

```bash
npm install
npm run dev
```

Server runs at http://localhost:5000. Expose `FRONTEND_URL` for CORS if the client is on another origin.

## Env

See `.env.example`. Required: `MONGO_URI`, `JWT_SECRET_KEY`, `CLOUDINARY_*`, `HIVEMQ_*`, `SMTP_*` (for OTP and password reset emails).
