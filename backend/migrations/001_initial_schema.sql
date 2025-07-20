-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Game sessions
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(10) UNIQUE NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
    max_players INTEGER NOT NULL CHECK (max_players > 0),
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    winner_id UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id) NOT NULL,
    
    -- Ensure logical timestamp ordering
    CONSTRAINT valid_timestamps CHECK (
        (started_at IS NULL OR started_at >= created_at) AND
        (finished_at IS NULL OR finished_at >= COALESCE(started_at, created_at))
    )
);

-- Game participants
CREATE TABLE game_participants (
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    player_order INTEGER NOT NULL CHECK (player_order > 0),
    joined_at TIMESTAMP DEFAULT NOW(),
    score INTEGER DEFAULT 0,
    left_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (session_id, user_id)
);

-- User statistics
CREATE TABLE user_statistics (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    total_games INTEGER DEFAULT 0 CHECK (total_games >= 0),
    total_wins INTEGER DEFAULT 0 CHECK (total_wins >= 0),
    total_losses INTEGER DEFAULT 0 CHECK (total_losses >= 0),
    total_draws INTEGER DEFAULT 0 CHECK (total_draws >= 0),
    ranking_score INTEGER DEFAULT 1000 CHECK (ranking_score >= 0),
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0 CHECK (best_streak >= 0),
    last_game_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure total games equals sum of wins, losses, draws
    CONSTRAINT valid_game_totals CHECK (total_games = total_wins + total_losses + total_draws)
);

-- Game type specific stats
CREATE TABLE game_type_stats (
    user_id UUID REFERENCES users(id),
    game_type VARCHAR(50) NOT NULL,
    games_played INTEGER DEFAULT 0 CHECK (games_played >= 0),
    wins INTEGER DEFAULT 0 CHECK (wins >= 0),
    losses INTEGER DEFAULT 0 CHECK (losses >= 0),
    draws INTEGER DEFAULT 0 CHECK (draws >= 0),
    average_duration INTERVAL,
    best_time INTERVAL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, game_type),
    
    -- Ensure games played equals sum of wins, losses, draws
    CONSTRAINT valid_type_game_totals CHECK (games_played = wins + losses + draws)
);

-- Game moves (for replay and analysis)
CREATE TABLE game_moves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    move_number INTEGER NOT NULL CHECK (move_number > 0),
    move_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(session_id, move_number)
);

-- Performance Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_game_sessions_room_code ON game_sessions(room_code);
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_sessions_game_type ON game_sessions(game_type);
CREATE INDEX idx_game_sessions_created_by ON game_sessions(created_by);
CREATE INDEX idx_game_sessions_created_at ON game_sessions(created_at DESC);

CREATE INDEX idx_game_participants_session ON game_participants(session_id);
CREATE INDEX idx_game_participants_user ON game_participants(user_id);
CREATE INDEX idx_game_participants_active ON game_participants(is_active);

CREATE INDEX idx_user_statistics_ranking ON user_statistics(ranking_score DESC);
CREATE INDEX idx_user_statistics_total_games ON user_statistics(total_games DESC);
CREATE INDEX idx_user_statistics_updated_at ON user_statistics(updated_at DESC);

CREATE INDEX idx_game_type_stats_user_game ON game_type_stats(user_id, game_type);
CREATE INDEX idx_game_type_stats_wins ON game_type_stats(wins DESC);

CREATE INDEX idx_game_moves_session ON game_moves(session_id, move_number);
CREATE INDEX idx_game_moves_user ON game_moves(user_id);

-- Triggers for automatic statistics updates
CREATE OR REPLACE FUNCTION update_user_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the updated_at timestamp
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_statistics_updated_at
    BEFORE UPDATE ON user_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_user_statistics();

CREATE TRIGGER game_type_stats_updated_at
    BEFORE UPDATE ON game_type_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_user_statistics();

-- Function to initialize user statistics when a user is created
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_statistics (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_created_stats
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_stats();

-- Function to generate unique room codes
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
    chars TEXT[] := '{A,B,C,D,E,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z,2,3,4,5,6,7,8,9}';
    result VARCHAR(6) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || chars[1 + random() * (array_length(chars, 1) - 1)];
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to validate game session constraints
CREATE OR REPLACE FUNCTION validate_game_session()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure winner is a participant if set
    IF NEW.winner_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM game_participants 
            WHERE session_id = NEW.id AND user_id = NEW.winner_id
        ) THEN
            RAISE EXCEPTION 'Winner must be a participant in the game session';
        END IF;
    END IF;
    
    -- Auto-set started_at when status changes to 'playing'
    IF NEW.status = 'playing' AND OLD.status != 'playing' AND NEW.started_at IS NULL THEN
        NEW.started_at = NOW();
    END IF;
    
    -- Auto-set finished_at when status changes to 'finished' or 'cancelled'
    IF NEW.status IN ('finished', 'cancelled') AND 
       OLD.status NOT IN ('finished', 'cancelled') AND 
       NEW.finished_at IS NULL THEN
        NEW.finished_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER game_session_validation
    BEFORE UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION validate_game_session();

-- Function to ensure player order is unique within a session
CREATE OR REPLACE FUNCTION validate_player_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if player_order already exists for this session
    IF EXISTS (
        SELECT 1 FROM game_participants 
        WHERE session_id = NEW.session_id 
        AND player_order = NEW.player_order 
        AND user_id != NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Player order % already exists in session %', NEW.player_order, NEW.session_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER participant_order_validation
    BEFORE INSERT OR UPDATE ON game_participants
    FOR EACH ROW
    EXECUTE FUNCTION validate_player_order();

-- Sample data for development (optional)
INSERT INTO users (username, email, password_hash) VALUES
    ('GameMaster', 'gamemaster@pugg.com', '$2b$12$dummy.hash.for.development.only'),
    ('ProGamer', 'progamer@pugg.com', '$2b$12$dummy.hash.for.development.only'),
    ('ChessKnight', 'chessknight@pugg.com', '$2b$12$dummy.hash.for.development.only')
ON CONFLICT (email) DO NOTHING;

-- Sample game types data
CREATE TABLE game_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_players INTEGER NOT NULL DEFAULT 2,
    max_players INTEGER NOT NULL DEFAULT 2,
    estimated_duration INTERVAL DEFAULT '5 minutes',
    difficulty_level VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO game_types (id, name, description, min_players, max_players, estimated_duration, difficulty_level) VALUES
    ('tictactoe', 'Tic Tac Toe', 'Classic 3x3 grid game', 2, 2, '3 minutes', 'easy'),
    ('checkers', 'Checkers', 'Strategic board game', 2, 2, '15 minutes', 'medium'),
    ('chess', 'Chess', 'Ultimate strategy game', 2, 2, '30 minutes', 'hard'),
    ('connect4', 'Connect Four', 'Connect 4 pieces in a row', 2, 2, '8 minutes', 'easy')
ON CONFLICT (id) DO NOTHING;

-- Views for easier querying
CREATE VIEW active_game_sessions AS
SELECT 
    gs.*,
    gt.name as game_name,
    u.username as created_by_username,
    COUNT(gp.user_id) as current_players
FROM game_sessions gs
JOIN game_types gt ON gs.game_type = gt.id
JOIN users u ON gs.created_by = u.id
LEFT JOIN game_participants gp ON gs.id = gp.session_id AND gp.is_active = true
WHERE gs.status IN ('waiting', 'playing')
GROUP BY gs.id, gt.name, u.username;

CREATE VIEW user_leaderboard AS
SELECT 
    u.id,
    u.username,
    us.total_games,
    us.total_wins,
    us.total_losses,
    us.total_draws,
    us.ranking_score,
    us.current_streak,
    us.best_streak,
    us.last_game_at,
    RANK() OVER (ORDER BY us.ranking_score DESC) as rank
FROM users u
JOIN user_statistics us ON u.id = us.user_id
WHERE u.is_active = true
ORDER BY us.ranking_score DESC;
