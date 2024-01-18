//Cross-Origin Resource Sharing to access variables from other domain from which the first source originated from.
const socketIO = require("socket.io");
const path = require("path");
const express = require("express");
const http = require("http");
const app = express();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();

// sets up a http server using app variable, app is an express application
const server = http.createServer(app);
const io = socketIO(server);

// sets the localhost port to 3000
const PORT = 3000;

// connect error socket.io
io.on("connect_error", (error) => {
  console.error("Connection Error:", error);
});

// file to load when server is started
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login_page/index.html");
});

//#region app.use
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.static("images"));
app.use(express.static(path.join(__dirname, "/images")));
// app.use(express.static(path.join(__dirname, "/public")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/", express.static(path.join(__dirname, "/public/login_page")));
app.use(cookieParser());
app.use(express.json());
app.use(cors());
// app.use("/static", express.static("public"));
//#endregion

const messages = [];

io.on("connection", (socket) => {
  // Send existing messages to the client
  socket.emit("chat history", messages);
  console.log("socket", socket);

  // Handle new messages from clients
  socket.on("chat message", (data) => {
    console.log("chat message data", data);
    const { username, msg, chat } = data;
    const messageWithUser = {
      username,
      msg,
      chat,
      socketId: socket.id,
    };
    console.log("server messagewith user", messageWithUser);
    messages.push(messageWithUser);
    io.emit("chat message", messageWithUser);
  });

  socket.on("disconnect", () => {});
});

//server now listens on localhost:3000
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
