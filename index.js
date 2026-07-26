const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const compression = require("compression");
const dotenv = require("dotenv");
const connectDB = require("./Config/db");
const propertyRoute = require("./Routes/propertyRoute");
const assetPropertyRoute = require("./Routes/AssetPropertyRoute");
const subRoutes =require("./Routes/subRoutes")
const userRoutes =require("./Routes/userRoutes")
const carRoutes = require("./Routes/carRoutes");
const landRoutes = require("./Routes/landRoutes");
const requestPropertyRoutes = require("./Routes/requestPropertyRoute");
const supplyPropertyRoutes = require("./Routes/supplyPropertyRoute");
const clothesRoutes = require("./Routes/clothesRoutes");
const messageRoutes = require("./Routes/messageRoutes");
const requestInfoRoutes = require("./Routes/requestInfoRoutes");
const bulkNoticationsRoutes= require("./Routes/bulkNotificationsRoutes");
const settingsRoutes = require("./Routes/settingsRoutes");
const supportFaqRoutes = require("./Routes/supportFAQRoutes");

const searchRoutes = require("./Routes/searchRoutes");

const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();
connectDB();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(compression());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
const allowedOrigins = [
	"http://localhost:5173",
	"https://paccy-easy-renting-fn.netlify.app"
  ];
  
  app.use(
	cors({
	  origin: function (origin, callback) {
		if (!origin || allowedOrigins.includes(origin)) {
		  callback(null, true);
		} else {
		  callback(new Error("Not allowed by CORS"));
		}
	  },
	  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	  credentials: true,
	  allowedHeaders: ["Content-Type", "Authorization"],
	})
  );
app.options("*", cors());
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// Dashboard route
const dashboardRoutes = require("./Routes/dashboardRoutes");
app.use("/api", dashboardRoutes);

// Other routes
app.use('/api', searchRoutes); 
app.use("/api", propertyRoute);
app.use("/api/property-asset", assetPropertyRoute); 
app.use("/api", subRoutes); 
app.use("/api", userRoutes); 
app.use("/api/request-property", requestPropertyRoutes);
app.use("/api/supply-property", supplyPropertyRoutes);
app.use("/api/", messageRoutes);
app.use("/api", requestInfoRoutes);
app.use('/api/car', carRoutes);
app.use('/api', landRoutes);
app.use('/api', clothesRoutes);
app.use("/api", bulkNoticationsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api", supportFaqRoutes);	
app.listen(PORT, () => {
  console.log(`Server is running on  http://localhost:${PORT}`);
});