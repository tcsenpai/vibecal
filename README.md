# VibeCal - Self-Hosted Calendar with Voting Events

A modern, self-hostable calendar web application with a unique voting events feature that allows users to vote on preferred times for events.

## Features

### Core Calendar Features
- **Multi-user calendar** - Google Calendar-like interface
- **Right-click context menu** - Quick event creation and management
- **Event management** - Create, view, and manage regular events
- **User authentication** - Secure registration and login system
- **Real-time updates** - Live updates using WebSocket connections
- **Public/private events** - Control event visibility
- **Different event types** - Visual distinction between regular and voting events

### Voting Events (Special Feature)
- **Time slot voting** - Users can vote on preferred time slots
- **Guest voting** - Allow non-registered users to vote via email
- **Multiple vote types** - Yes, No, and Maybe options
- **Real-time vote updates** - See votes as they come in
- **Event finalization** - Convert voting events to regular events
- **Voting deadlines** - Set time limits for voting

## Tech Stack

### Backend
- **Node.js** with TypeScript
- **Express.js** for REST API
- **PostgreSQL** for database
- **Socket.io** for real-time updates
- **JWT** for authentication
- **bcrypt** for password hashing

### Frontend
- **Next.js 14** with TypeScript
- **React** with hooks
- **Tailwind CSS** for styling
- **React Big Calendar** for calendar component
- **Zustand** for state management
- **React Query** for data fetching
- **React Hook Form** for form handling

### Deployment
- **Docker & Docker Compose** for containerization
- **PostgreSQL** in Docker container
- Self-hostable on any server with Docker support

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for development)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd vibecal
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies (for development):**
   ```bash
   npm run setup
   ```

4. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Database: localhost:5432

### Development Mode

For development with hot reloading:

```bash
# Terminal 1 - Start database
docker-compose up postgres -d

# Terminal 2 - Start backend
cd backend
npm install
npm run dev

# Terminal 3 - Start frontend  
cd frontend
npm install
npm run dev
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DB_PASSWORD=your_secure_password

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-jwt-key

# URLs
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Database Setup

The database schema is automatically initialized when using Docker Compose. For manual setup:

```bash
psql -U postgres -d vibecal -f backend/src/models/database.sql
```

## Usage

### Creating Regular Events
1. **Quick creation via right-click:** Right-click any empty time slot and select "Create Event"
2. **Button creation:** Click "New Event" in the calendar interface
3. Fill in event details (title, description, time, location)
4. Set visibility (public/private)
5. Save the event

### Creating Voting Events
1. **Quick creation via right-click:** Right-click any empty time slot and select "🗳️ Create Voting Event"
2. **Button creation:** Click "New Event" and select "🗳️ Voting Event"
3. **Add Time Slot Options:**
   - Use the prominent time slots interface to add multiple options
   - Each option needs a start and end time
   - Use "Quick Add" buttons for common scenarios:
     - "Next 3 afternoons" - adds 2PM slots for the next 3 days
     - "Weekday mornings" - adds 10AM slots for the next 5 weekdays
   - You can add up to 10 different time options
4. **Configure Voting Settings:**
   - **Guest voting:** Allow people without accounts to vote
   - **Maybe votes:** Enable "maybe" option in addition to yes/no
   - **Voting deadline:** Set when voting should end (optional)
5. The voting event appears in orange on the calendar

### Managing Existing Events

**Right-click any event** to access:
- **View Event** - See full event details and voting interface
- **Edit Event** - Modify event details
- **Delete Event** - Remove the event permanently

### How Voting Works
1. **Participants access the event:** Either through the calendar or a direct voting link
2. **Vote on each time slot:** 
   - ✅ **Yes** - Can attend at this time
   - ❌ **No** - Cannot attend at this time  
   - ❓ **Maybe** - Might be able to attend (if enabled)
3. **Real-time updates:** Vote counts update immediately for all participants
4. **See who voted:** View which users voted for each option
5. **Finalize the event:** Creator can select the winning time slot and convert to a regular event

### Guest Voting Experience
When guest voting is enabled:
1. **No account needed:** Guests can vote without creating an account
2. **Simple form:** Enter name and email to vote
3. **Direct voting links:** Event creators can generate special links like:
   ```
   https://your-domain.com/vote/123?token=abc123
   ```
4. **Anonymous or identified:** Guests can vote with their name or anonymously

### Voting Event vs Regular Event
| Feature | Regular Event | Voting Event |
|---------|---------------|--------------|
| **Time setting** | Set specific date/time | Propose multiple time options |
| **Participation** | Invite/accept model | Vote on preferred times |
| **Flexibility** | Fixed schedule | Democratic time selection |
| **Guest access** | Requires account | Optional guest voting |
| **Finalization** | Ready to use | Requires time selection |

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Event Endpoints
- `GET /api/events` - Get user's events
- `POST /api/events` - Create new event
- `GET /api/events/:id` - Get event details
- `POST /api/events/:id/vote` - Submit vote
- `POST /api/events/:eventId/time-slots` - Add time slot
- `POST /api/events/:eventId/finalize` - Finalize voting event

## Deployment

### Production Deployment

1. **Update environment variables:**
   ```env
   FRONTEND_URL=https://your-domain.com
   NEXT_PUBLIC_API_URL=https://api.your-domain.com
   JWT_SECRET=your-production-secret
   DB_PASSWORD=secure-production-password
   ```

2. **Deploy with Docker:**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

3. **Set up reverse proxy (nginx example):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   
   server {
       listen 80;
       server_name api.your-domain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Backup and Restore

**Backup database:**
```bash
docker exec vibecal-postgres-1 pg_dump -U postgres vibecal > backup.sql
```

**Restore database:**
```bash
docker exec -i vibecal-postgres-1 psql -U postgres vibecal < backup.sql
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues and feature requests, please use the GitHub issues tracker.