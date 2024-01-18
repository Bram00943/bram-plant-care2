const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const socketIo = require("socket.io");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// protected route if fetch from here verify required!

const secretKey = process.env.SECRET_KEY;

const uri = process.env.MONGODB_URI;

mongoose.connect(uri).then(() => console.log("Connected!"));

const http = require("http");

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

const verifyToken = (req, res, next) => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader) {
    return res
      .status(401)
      .json({ message: "Unauthorized - Missing Authorization Header" });
  }

  const token = authorizationHeader.split(" ")[1];

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    req.userData = decoded; // Attach user data to the request object
    next();
  });
};

app.use(verifyToken);

app.get("/api/protected-route", verifyToken, (req, res) => {
  res.json({ message: "Protected route accessed", user: req.userData });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`both clicker games endpoints are running on ${PORT}`);
});
