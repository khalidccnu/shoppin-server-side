const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

dotenv.config();
app.use(cors());

const mdbClient = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

(async (_) => {
  try {
    const categories = mdbClient.db("shoppin").collection("categories");
    const products = mdbClient.db("shoppin").collection("products");

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

      if (req.query.id) {
        const query = { _id: new ObjectId(req.query.id) };
        result = await products.findOne(query);
      } else if (req.query.cid) {
        const query = { category_id: req.query.cid };
        const cursor = products.find(query);
        const arr = await cursor.toArray();
        result = shuffle(arr);
      } else {
        const cursor = products.find();
        result = await cursor.toArray();
      }

      res.send(result);
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

    mdbClient
      .db("admin")
      .command({ ping: 1 })
      .then((_) => console.log("Successfully connected to MongoDB!"));
  } catch (err) {
    console.log("Did not connect to MongoDB! " + err.message);
  } finally {
    await mdbClient.close();
  }
})();

app.get("/", (req, res) => {
  res.send("Shoppin is running...");
});

app.listen(port, (_) => {
  console.log(`Shoppin API is running on port: ${port}`);
});
