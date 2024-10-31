# NATS JetStream setup guide to run in local

Guide for setting up NATS JetStream streams and consumers with recommended patterns and commands.

## Prerequisites

### Install NATS CLI

```bash
brew install nats-io/nats-tools/nats
```

### config npm to install a private package

Note: replace `<your-token>` with npm @durolabs/nats.js from 1password

```bash
npm config set "//registry.npmjs.org/:_authToken" "<your-token>"
```

### Run NATS server with JetStream enabled

```yaml
# docker-compose.yml
services:
  nats:
    image: nats:latest
    command: "-js"
    restart: always
    ports:
      - "4222:4222"
      - "8222:8222"
```

```bash
docker-compose up -d
```

### create a stream

run below and answer no to all questions

```bash
nats stream add EVENTS --subjects "items.>, users.>" --replicas 1 --storage file --retention limits --ack --discard old --dupe-window 2m --max-msgs=-1 --max-msgs-per-subject=-1 --max-bytes=-1 --max-age=0 --max-msg-size=-1 --max-consumers=-1
```

## Usage

### Install @durolabs/nats.js

```bash
npm install @durolabs/nats.js
```

### create a producer and run it on a port of your choice

```js
import express, { Request, Response } from "express";
import { connectNats, publish } from "@durolabs/nats.js";
import { PubAck } from "nats";
async function main() {
  const app = express();
  app.use(express.json());
  const PRODUCER_PORT = process.env.PRODUCER_PORT || 3000;
  const NATS_URL = process.env.NATS_URL || "nats://localhost:4222";
  const streamName = "EVENTS";

  const { nc, js } = await connectNats({ url: NATS_URL });

  app.post("/publish", async (req: Request, res: Response) => {
    try {
      const { message, subject } = req.body;
      if (!message || !subject) {
        return res.status(400).send("message and subject are required");
      }
      const published: PubAck = await publish({
        nc,
        js,
        data: message,
        subject,
        streamName,
      });
      // TODO: handle ack if needed
      res.send("Message published to NATS");
    } catch (err: any) {
      res.status(404).send(`Error publishing message: ${err.message}`);
    }
  });

  app.listen(PRODUCER_PORT, () => {
    console.log(`Express server running on http://localhost:${PRODUCER_PORT}`);
  });
}

main();
```

#### publish a message example

```bash
curl --location 'http://localhost:3000/publish' \
--header 'Content-Type: application/json' \
--data '{
    "subject": "items.created",
    "message": {
        "name": "25 High-Performance Bearing",
        "description": "Precision engineered bearing for industrial use",
        "cpn": "CUS-BRG-001",
        "category": "Bearings",
        "subcategory": "Industrial",
        "manufacturer": "SKF",
        "mpn": "SKF-6201",
        "status": "active",
        "inventory": {
            "quantity": 100,
            "location": "WAREHOUSE-A"
        },
        "created_at": "2024-10-25T14:30:00Z",
        "created_by": "system"
    }
}'
```

### create a consumer in a different terminal

```bash
npm run consumer
```

#### consume a message

```js
import express from "express";
import { connectNats, consumeMessages } from "@durolabs/nats.js";

async function main() {
  const app = express();
  const CONSUMER_PORT = process.env.CONSUMER_PORT || 3001;
  const consumerName = "event_sourcing_service_consumer_x";
  app.use(express.json());
  const NATS_URL = process.env.NATS_URL || "nats://localhost:4222";
  const { nc, js } = await connectNats({ url: NATS_URL });
  let counter = 39;
  async function handleMessage(message: any) {
    console.log(
      `processing message number ${counter}: ${JSON.stringify(message)}\n\n`
    );
    counter++;
    // add your logic here to deduplicate the messages and save the data or perform any other action such as sending a notification
  }
  await consumeMessages({
    js,
    streamName: "EVENTS",
    subjects: ["users.created", "items.created"],
    consumerName,
    processMessage: handleMessage,
  });
  // subscribe(nc, "item.create", handleMessage);
  app.listen(CONSUMER_PORT, () => {
    console.log(`Express server running on http://localhost:${CONSUMER_PORT}`);
  });
}

main();
```

You should see the message in the consumer terminal as soon as you publish a message to the producer.

see a working example here: https://github.com/durolabs/nats-poc
