# NATS Credentials and Messaging Conventions

## Connecting to the NATS Cluster

- To connect to the NATS cluster in GCP, retrieve the credentials from **1Password** under `Nats Credentials for dev`.

---

## Interface Conventions for Subjects

We follow a standard convention for defining message interfaces per subject.  
- An interface should be created in this package to be shared across all services interested in a particular subject.  
- This ensures consistent typing and structure for both publishers and consumers.  

**Example:**  
See the interface for [itemCreatedDto](https://github.com/duronext/nats.js/blob/main/src/event-dto/item-created.event.dto.ts).  

---

## Publishing Messages

To publish messages, use the `@durolabs/nats.js` library.  
- **Example:**  
  See the full implementation [here in plm-items](https://github.com/duronext/phoenix/blob/main/apps/plm-items/src/events/item-event.ts), including how to publish a message and which interfaces to use.

### Conventions for Publishing
1. **Stream**: Messages are published to the `EVENTS` stream, which is created by default during NATS server setup.
2. **Subject Naming**:  
   Each message subject should follow the pattern `[entity].>`, where `entity` is the plural form of the entity being published.  
   **Examples:**  
   - `items.created`  
   - `items.updated`  
   - `users.updated`  
   - `changeorders.updated`  
3. If a subject does not exist in the `EVENTS` stream, it will be created automatically.

---

## Consuming Messages

To consume messages, use the `@durolabs/nats.js` library.  
- **Example:**  
  See the full implementation [here in eventsourcing](https://github.com/duronext/phoenix/blob/main/apps/eventsourcing/src/consumer/consumer.service.ts).  

### Conventions for Consumers
1. **Unique Consumer Name**:  
   Each consumer should have a unique name that follows the pattern `[service name].consumer`.  
   The service name must be set in the `SERVICE_NAME` environment variable.  
2. If a consumer is not found in the `EVENTS` stream, it will be created automatically.

---



## Usage (if you want to run it locally - you can skip this step)

### Install NATS CLI

```bash
brew install nats-io/nats-tools/nats
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

#### Note: stream `EVENTS` is created as part of the NATS server setup. This will be used by default by the consumer.

run below and answer no to all questions

```bash
nats stream add EVENTS --subjects "items.>, users.>" --replicas 1 --storage file --retention limits --ack --discard old --dupe-window 2m --max-msgs=-1 --max-msgs-per-subject=-1 --max-bytes=-1 --max-age=0 --max-msg-size=-1 --max-consumers=-1
```

### Install @durolabs/nats.js

```bash
npm i @durolabs/nats.js
```

### Steps:

- create a producer and run it on a port of your choice

- publish messages

- create a consumer in a different terminal

- consume a message example

You should see the message in the consumer terminal as soon as you publish a message to the producer.

see a working example here: https://github.com/durolabs/nats-js-express-example

_Happy event sourcing!_
