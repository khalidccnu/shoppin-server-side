require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SK);

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

const mdbClient = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access!" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "Forbidden access!" });
    }

    next();
  });
};

(async (_) => {
  try {
    const categories = mdbClient.db("shoppin").collection("categories");
    const products = mdbClient.db("shoppin").collection("products");
    const users = mdbClient.db("shoppin").collection("users");
    const orders = mdbClient.db("shoppin").collection("orders");

    const shuffle = (arr) => {
      let currentIndex = arr.length,
        randomIndex;

      while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [arr[currentIndex], arr[randomIndex]] = [
          arr[randomIndex],
          arr[currentIndex],
        ];
      }

      return arr;
    };

    app.get("/categories", async (req, res) => {
      let result;

      if (req.query.id) {
        const query = { _id: new ObjectId(req.query.id) };
        result = await categories.findOne(query);
      } else {
        const cursor = categories.find();
        result = await cursor.toArray();
      }

      res.send(result);
    });

    app.get("/products", async (req, res) => {
      let result;

      if (req.query.count) {
        result = await products.countDocuments();
      } else if (req.query.id) {
        const query = { _id: new ObjectId(req.query.id) };
        result = await products.findOne(query);
      } else if (req.query.cid) {
        const query = { category_id: req.query.cid };
        const cursor = products.find(query);
        const arr = await cursor.toArray();
        result = shuffle(arr);
      } else if (req.query.page && req.query.limit) {
        let page = req.query.page;
        let limit = +req.query.limit;
        let skip = (page - 1) * limit;

        const cursor = products.find().skip(skip).limit(limit);
        result = await cursor.toArray();
      } else {
        const cursor = products.find();
        result = await cursor.toArray();
      }

      res.send(req.query.count ? { totalProducts: result } : result);
    });

    app.get("/products/featured", async (req, res) => {
      const query = { featured: true };
      const cursor = products.find(query);
      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/products/discount", async (req, res) => {
      const query = { discount: true };
      const cursor = products.find(query);
      const result = await cursor.toArray();

      res.send(result);
    });

    app.post("/products", async (req, res) => {
      let result;

      if (req.query.ids) {
        const ids = req.body.map((id) => new ObjectId(id));

        const query = { _id: { $in: ids } };
        const cursor = products.find(query);
        result = await cursor.toArray();
      } else {
        result = await products.insertOne(req.body);
      }

      res.send(result);
    });

    app.put("/products", async (req, res) => {
      const query = { _id: new ObjectId(req.query.id) };
      const result = await products.updateOne(query, { $set: req.body });

      res.send(result);
    });

    app.delete("/products", async (req, res) => {
      const query = { _id: new ObjectId(req.query.id) };
      const result = await products.deleteOne(query);

      res.send(result);
    });

    app.get("/users", verifyJWT, async (req, res) => {
      const query = { _id: req.query.id };
      const result = await users.findOne(query);

      !result
        ? res.send({
            error: true,
            status: 500,
            statusText: "No value exist!",
          })
        : res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await users.insertOne(user);

      res.send(result);
    });

    app.patch("/users", async (req, res) => {
      const user = req.body;
      const query = { _id: req.query.id };
      const result = await users.updateOne(query, { $set: user });

      res.send(result);
    });

    app.get("/orders", async (req, res) => {
      let query = {},
        result;

      if (req.query.id) query = { ct_key: req.query.id };

      if (req.query.count) {
        result = await orders.countDocuments(query);
      } else if (req.query.page && req.query.limit) {
        let page = req.query.page;
        let limit = +req.query.limit;
        let skip = (page - 1) * limit;

        const cursor = orders.find(query).skip(skip).limit(limit);
        result = await cursor.toArray();
      } else {
        const cursor = orders.find(query);
        result = await cursor.toArray();
      }

      res.send(req.query.count ? { totalOrders: result } : result);
    });

    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orders.insertOne(order);

      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const amount = req.body.grandTotal * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send(paymentIntent.client_secret);
    });

    mdbClient
      .db("admin")
      .command({ ping: 1 })
      .then((_) => console.log("Successfully connected to MongoDB!"));
  } catch (err) {
    console.log("Did not connect to MongoDB! " + err.message);
  } finally {
    // await mdbClient.close();
  }
})();

app.get("/", (req, res) => {
  res.send("Shoppin is running...");
});

app.post("/jwt", (req, res) => {
  const userId = req.body;

  const token = jwt.sign(userId, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "6h",
  });

  res.send(token);
});

app.listen(port, (_) => {
  console.log(`Shoppin API is running on port: ${port}`);
});
