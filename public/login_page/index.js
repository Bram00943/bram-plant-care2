//Cross-Origin Resource Sharing to access variables from other domain from which the first source originated from.
const cors = require("cors");
const socketIO = require("socket.io");
const path = require("path");
//Parse incomming req.body in a middleware before handlers.
const bodyParser = require("body-parser");
//Create express application.
const express = require("express");
//Parse Cookie header and populate req.cookies with an object keyed by the cookie names.
const cookieParser = require("cookie-parser");
const http = require("http");
//Use mongoose
const mongoose = require("mongoose");
//Schema maps to a MongoDB collection and defines the shape of the documents within that collection.
const { Schema } = mongoose;
const { MongoClient, ServerApiVersion, ClientEncryption } = require("mongodb");
//Proposed Internet standard for creating data with optional signature and/or optional encryption whose payload holds JSON.
const jwt = require("jsonwebtoken");
const app = express();
//Loads environment variables from .env file.
require("dotenv").config();
//To encrypt password string.
const bcrypt = require("bcrypt");
const multer = require("multer");

//secretKey to sign JWT - Json Web Token
const secretKey = process.env.SECRET_KEY;

//link to connect to mongoDB
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//connect to the mongoDB
mongoose.connect(uri).then(() => console.log("Connected!"));

//#region app.use
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "/public/login_page/images")));
app.use(express.static(path.join(__dirname, "/public")));
app.use("/", express.static(path.join(__dirname, "public")));
app.use(express.static("images"));
app.use(express.static(path.join(__dirname, "/images")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(cookieParser());
app.use(express.json());
app.use(cors());
//#endregion

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3002;

//setup user with variables
const userSchema = new Schema({
  username: String,
  password: String,
  plantData: [
    {
      plantName: String,
      species: String,
      plantImages: String,
      progressImages: [{ progressImageUrl: String }],
      extraInfo: String,
    },
  ],
});

// create the user
const User = mongoose.model("User", userSchema);

//post the user to the database with the username and password from client side
app.post("/api/create-user", async (req, res) => {
  try {
    // get userData from the client side create account function
    const user = req.body;
    //check for existing user before creating the account
    const existingUser = await User.findOne({ username: user.username });
    // send error message to client
    if (existingUser) {
      return res.status(400).json({ message: "Username is already in use" });
    }

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(user.password, 10); // 10 is the number of salt rounds

    //create the new user in the database with the following data
    const newUser = await User.create({
      username: user.username,
      password: hashedPassword,
      plantData: user.plantData,
    });

    res.status(400).json({ message: "Account creation successfull" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error saving user" });
  } finally {
    await client.close();
  }
});

app.post("/api/login", async (req, res) => {
  try {
    // get userData from the client side login function
    const { username, password } = req.body;

    // Find the user in the database by username
    const user = await User.findOne({ username });

    //if user doesn't match any in the database, error message to client
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Compare the provided password with the hashed password stored in the database
    const passwordMatch = await bcrypt.compare(password, user.password);

    //if password doesn't match any in the database, error message to client
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // If the username and password are valid, generate a JWT token with the data of the user
    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        plantData: user.plantData,
      },
      secretKey
    );
    // Set the token as a cookie and send it back to the client
    res.cookie("your_token_cookie", token, { httpOnly: true });
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error during login" });
  } finally {
    await client.close();
  }
});

app.post("/api/add-plant/:userId", async (req, res) => {
  try {
    // Get user data from the req
    const { imageUrl, commonName, scientificName } = req.body;
    const userId = req.params.userId;

    const user = await User.findById(userId);
    // Add the plant data to the user's plantData array
    user.plantData.push({
      plantName: commonName,
      species: scientificName,
      plantImages: imageUrl,
      extraInfo: "",
    });

    // Save the updated user data
    await user.save();

    res.status(200).json({ message: "Plant added to user data successfully" });
  } catch (error) {
    console.error("Error adding plant to user data:", error.message);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.delete("/api/delete-plant/:userId/:plantIndex", async (req, res) => {
  try {
    const userId = req.params.userId;
    const plantIndex = parseInt(req.params.plantIndex);

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if plantIndex is valid
    if (plantIndex >= 0 && plantIndex < user.plantData.length) {
      // Remove the plant at the specified index
      user.plantData.splice(plantIndex, 1);

      // Save the updated user data to the database
      await user.save();

      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid plant index" });
    }
  } catch (error) {
    console.error("Error deleting plant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete(
  "/api/delete-image/:userId/:plantIndex/:imageId",
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const plantIndex = parseInt(req.params.plantIndex);
      const imageId = req.params.imageId;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if plantIndex is valid
      if (plantIndex >= 0 && plantIndex < user.plantData.length) {
        const plant = user.plantData[plantIndex];

        // Find the index of the image with the specified imageId
        const imageIndex = plant.progressImages.findIndex(
          (image) => image._id.toString() === imageId
        );

        if (imageIndex !== -1) {
          // Remove the image at the specified index
          plant.progressImages.splice(imageIndex, 1);

          // Save the updated user data to the database
          await user.save();

          res.json({ success: true });
        } else {
          res.status(400).json({ error: "Image not found" });
        }
      } else {
        res.status(400).json({ error: "Invalid plant index" });
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.get("/api/get-user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    console.log("user get user: ", user);
    if (user) {
      res.json({ user });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await client.close();
  }
});

app.post("/api/add-info/:userId/:currentPlantIndex", async (req, res) => {
  try {
    // Get user data from the req
    const { infoText } = req.body;
    const userId = req.params.userId;
    const currentPlantIndex = req.params.currentPlantIndex;

    const user = await User.findById(userId);

    const serverPlantIndex = currentPlantIndex;

    user.plantData[serverPlantIndex].extraInfo = infoText;
    console.log("server infoText:", infoText);

    // Save the updated user data
    await user.save();
    res
      .status(200)
      .json({ message: "Extra info added to user data successfully" });
  } catch (error) {
    console.error("Error adding extra info to user data:", error.message);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.post("/api/logout", (req, res) => {
  // Clear the token cookie
  res.clearCookie("your_token_cookie");
  res.status(200).json({ message: "Logout successful" });
});

//used to decode and verify the token
app.use(async (req, res, next) => {
  const token = req.cookies && req.cookies.your_token_cookie;
  if (token) {
    try {
      const decoded = jwt.verify(token, secretKey);
      const user = await User.findById(decoded.Id);

      if (user) {
        req.user = user;
      } else {
        res.status(401).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error decoding token:", error);
      res.status(401).json({ message: "Invalid token" });
    }
  }

  next();
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images"); // Store files in the 'images' directory
  },
  filename: function (req, file, cb) {
    const fileName = file.originalname; // Use the original file name
    cb(null, fileName);
  },
});

const upload = multer({ storage: storage });

// Endpoint for handling file uploads
app.post("/upload-image/:userId", upload.single("file"), async (req, res) => {
  try {
    // Extract user ID from the req
    const userId = req.params.userId;
    const { plantIndex } = req.body;

    // Update the user's plantData with the uploaded file name
    const user = await User.findById(userId);
    console.log(" plant index server", plantIndex);
    if (user) {
      const fileName = req.file.originalname;
      if (plantIndex >= 0 && plantIndex < user.plantData.length) {
        user.plantData[plantIndex].progressImages.push({
          progressImageUrl: fileName,
        });
        console.log("server userplant data", user.plantData);
        await user.save();
        res.json({ message: "File uploaded successfully", fileName });
      } else {
        res.status(400).json({ message: "Invalid plant index" });
      }
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

//socket connection
io.on("connection", function (socket) {
  console.log("mobile login endpoint connected socket io");
  socket.on("disconnect", function () {
    console.log("A user disconnected");
  });
});

//server now listens on localhost:3002
server.listen(PORT, "0.0.0.0", () => {
  console.log(`mobile endpoint is running at ${PORT}`);
});
