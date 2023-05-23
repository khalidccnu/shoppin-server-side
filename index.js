const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

dotenv.config();
app.use(cors());
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
