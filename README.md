# Event Notification System

A serverless birthday notification system that sends messages to users at 9 AM in their local timezone using AWS Lambda, DynamoDB, SQS, and EventBridge Scheduler.

## How it works

1. User creates an account with their birthday and timezone
2. System schedules an EventBridge event for their next birthday at 9 AM (in their timezone)
3. When the birthday arrives, EventBridge sends a message to SQS
4. Lambda worker processes the message and sends a birthday notification
5. System reschedules for next year

## Prerequisites

- Node.js 20.x or later
- Docker (for local DynamoDB)
- AWS Account (for deployment)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Setup environment

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
IS_OFFLINE=true
AWS_REGION=ap-southeast-1
AWS_ACCOUNT_ID=123456789012
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
USERS_TABLE_NAME=users-table-dev
HOOKBIN_URL=https://hookbin.com/your-webhook-url
```

### 3. Start local DynamoDB

```bash
docker compose up -d
npm run migrate
```

### 4. Run the application

```bash
npm start
```

API will be available at `http://localhost:3000`

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Current test coverage: 47 tests across 7 test suites

## API Endpoints

### Create User

```bash
POST /user

{
  "firstName": "John",
  "lastName": "Doe",
  "birthday": "1990-05-15",
  "location": "America/New_York"
}
```

### Get User

```bash
GET /user/{userId}
```

### Update User

```bash
PUT /user/{userId}

{
  "firstName": "Jane",
  "birthday": "1990-06-20"
}
```

### Delete User

```bash
DELETE /user/{userId}
```

## Project Structure

```
src/
├── functions/
│   ├── api/              # HTTP API handlers
│   └── worker/           # SQS message processor
├── services/             # Business logic
├── lib/                  # Utilities and clients
└── types.ts             # TypeScript types
```

## Architecture

```
HTTP API → DynamoDB → EventBridge Scheduler → SQS → Lambda Worker → Webhook
```

When a user is created, their birthday gets scheduled in EventBridge. On their birthday at 9 AM (in their timezone), EventBridge sends a message to SQS, which triggers the Lambda worker to send the birthday notification and reschedule for next year.

## Local Development Notes

- EventBridge Scheduler doesn't work in offline mode. Scheduling operations will be logged but not executed.
- DynamoDB runs locally via Docker on port 8000
- Use the webhook URL to see birthday messages when testing

## Deployment

```bash
# Configure AWS credentials
aws configure

# Deploy
npx sls deploy --stage dev
```

After deployment, you'll get API endpoints that you can use instead of localhost.

## Common Issues

**DynamoDB connection fails**
Make sure Docker is running: `docker compose up -d`

**Table already exists**
Drop and recreate: `docker compose down -v && docker compose up -d && npm run migrate`

**Tests failing**
Check that mocks are reset in `beforeEach()` blocks

**Module not found**
Reinstall: `rm -rf node_modules package-lock.json && npm install`

## Environment Variables

| Variable         | Description               | Required   |
| ---------------- | ------------------------- | ---------- |
| IS_OFFLINE       | Local development mode    | Local only |
| AWS_REGION       | AWS region                | Yes        |
| AWS_ACCOUNT_ID   | Your AWS account ID       | Yes        |
| USERS_TABLE_NAME | DynamoDB table name       | Auto-set   |
| HOOKBIN_URL      | Webhook for notifications | Yes        |


If you're new to serverless or AWS, here's what these services do:

**Lambda**: Your code runs only when needed, you pay only for execution time

**EventBridge Scheduler**: Like a cron job in the cloud - schedules tasks to run at specific times

**SQS**: Message queue - stores messages until they're processed

**DynamoDB**: NoSQL database - stores data as key-value pairs instead of SQL tables

**Why mock in tests?**: We don't want tests making real AWS calls (slow, costs money, needs credentials)
