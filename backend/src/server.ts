import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import { createWebCalRoutes } from "./routes/webcal";

import authRoutes from "./routes/auth";
import eventsRoutes from "./routes/events";
import healthRoutes from "./routes/health";
import adminRoutes from "./routes/admin";

import {
  unhandledRejectionHandler,
  uncaughtExceptionHandler,
} from "./middleware/errorHandler";
import { errorHandler, notFoundHandler } from "./utils/errorHandler";
import { sanitizeInput } from "./middleware/validation";
import { logger, requestLogger, logSecurityEvent } from "./utils/logger";
import { checkDatabaseHealth, closeDatabaseConnection } from "./utils/database";
import database from "./utils/database";

dotenv.config();

// Initialize error handlers
unhandledRejectionHandler();
uncaughtExceptionHandler();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting and IP detection
app.set("trust proxy", 1);

// Request ID middleware
app.use((req, res, next) => {
  req.headers["x-request-id"] = uuidv4();
  next();
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting with multiple tiers
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent("rate_limit_exceeded", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.url,
      method: req.method,
    });
    res.status(429).json({
      error: "Too many requests from this IP, please try again later.",
    });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // More restrictive for auth endpoints
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  handler: (req, res) => {
    logSecurityEvent("auth_rate_limit_exceeded", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.url,
    });
    res.status(429).json({
      error: "Too many authentication attempts, please try again later.",
    });
  },
});

app.use(generalLimiter);

// Request logging
app.use(requestLogger);

// Body parsing middleware with limits
app.use(
  express.json({
    limit: "10mb",
    type: "application/json",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// Input sanitization
app.use(sanitizeInput);

// Routes with specific rate limiting
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/", healthRoutes);

// WebCal routes
try {
  app.use(createWebCalRoutes(database));
  logger.info("WebCal routes initialized successfully");
} catch (error) {
  logger.error("Failed to initialize WebCal routes:", error);
}

// WebDAV support disabled pending full implementation
// To enable, implement CalDAV routes and uncomment

// Socket.io for real-time updates with enhanced error handling
io.on("connection", (socket) => {
  logger.info("Socket connection established", { socketId: socket.id });

  socket.on("join-event", (eventId) => {
    if (typeof eventId === "string" && eventId.match(/^\d+$/)) {
      socket.join(`event-${eventId}`);
      logger.debug("User joined event room", { socketId: socket.id, eventId });
    } else {
      logger.warn("Invalid eventId in join-event", {
        socketId: socket.id,
        eventId,
      });
    }
  });

  socket.on("leave-event", (eventId) => {
    if (typeof eventId === "string" && eventId.match(/^\d+$/)) {
      socket.leave(`event-${eventId}`);
      logger.debug("User left event room", { socketId: socket.id, eventId });
    }
  });

  socket.on("error", (error) => {
    logger.error("Socket error", { socketId: socket.id, error });
  });

  socket.on("disconnect", (reason) => {
    logger.info("Socket disconnected", { socketId: socket.id, reason });
  });
});

// 404 handler
app.use("*", notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  server.close(async () => {
    logger.info("HTTP server closed");

    try {
      await closeDatabaseConnection();
      logger.info("Database connections closed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server with database validation
const startServer = async () => {
  try {
    // Validate database connection on startup
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.status !== "healthy") {
      throw new Error("Database health check failed on startup");
    }

    server.listen(PORT, () => {
      logger.info("Server started successfully", {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        uptime: process.uptime(),
      });
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export { app, io };
