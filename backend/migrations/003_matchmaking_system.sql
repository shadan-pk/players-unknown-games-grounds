-- Enhanced user statistics with ELO rating system
ALTER TABLE user_statistics ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1000;
ALTER TABLE user_statistics ADD COLUMN IF NOT EXISTS peak_rating INTEGER DEFAULT 1000;
ALTER TABLE user_statistics ADD COLUMN IF NOT EXISTS matches_today INTEGER DEFAULT 0;
ALTER TABLE user_statistics ADD COLUMN IF NOT EXISTS last_match_date DATE;

-- Game sessions updates
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS match_type VARCHAR(20) DEFAULT 'casual' CHECK (match_type IN ('casual', 'ranked'));
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS average_elo INTEGER;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS elo_change JSONB; -- Store ELO changes for each player

-- Game participants updates
ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS elo_before INTEGER DEFAULT 1000;
ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS elo_after INTEGER DEFAULT 1000;
ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS elo_change INTEGER DEFAULT 0;
ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS placement INTEGER; -- For games with rankings
ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMP;
ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS forfeit BOOLEAN DEFAULT false;

-- Matchmaking queue
CREATE TABLE matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL,
    match_type VARCHAR(20) DEFAULT 'casual',
    elo_rating INTEGER NOT NULL DEFAULT 1000,
    preferences JSONB DEFAULT '{}',
    joined_at TIMESTAMP DEFAULT NOW(),
    estimated_wait_time INTERVAL,
    region VARCHAR(10) DEFAULT 'global',
    
    UNIQUE(user_id, game_type) -- Prevent duplicate queue entries
);

-- Match history for detailed tracking
CREATE TABLE match_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    game_type VARCHAR(50) NOT NULL,
    match_type VARCHAR(20) DEFAULT 'casual',
    result VARCHAR(20) NOT NULL CHECK (result IN ('win', 'loss', 'draw', 'disconnect', 'forfeit')),
    elo_before INTEGER NOT NULL,
    elo_after INTEGER NOT NULL,
    elo_change INTEGER NOT NULL,
    placement INTEGER,
    duration INTERVAL,
    moves_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Player achievements
CREATE TABLE achievements (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    category VARCHAR(50), -- 'wins', 'games', 'streaks', 'special'
    requirement_type VARCHAR(20), -- 'count', 'streak', 'rating', 'special'
    requirement_value INTEGER,
    points_reward INTEGER DEFAULT 0,
    is_hidden BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User achievements
CREATE TABLE user_achievements (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) REFERENCES achievements(id),
    earned_at TIMESTAMP DEFAULT NOW(),
    progress INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, achievement_id)
);

-- Daily/Weekly challenges
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(20), -- 'daily', 'weekly', 'monthly'
    game_type VARCHAR(50), -- NULL for global challenges
    requirement JSONB NOT NULL,
    reward_points INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User challenge progress
CREATE TABLE user_challenge_progress (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    claimed_at TIMESTAMP,
    PRIMARY KEY (user_id, challenge_id)
);

-- Indexes for performance
CREATE INDEX idx_matchmaking_queue_game_type ON matchmaking_queue(game_type, match_type, elo_rating);
CREATE INDEX idx_matchmaking_queue_joined_at ON matchmaking_queue(joined_at);
CREATE INDEX idx_match_history_user_game ON match_history(user_id, game_type);
CREATE INDEX idx_match_history_created_at ON match_history(created_at DESC);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- Insert sample achievements
INSERT INTO achievements (id, name, description, icon, category, requirement_type, requirement_value, points_reward) VALUES
    ('first_win', 'First Victory', 'Win your first match', '🏆', 'wins', 'count', 1, 100),
    ('win_streak_3', 'Triple Threat', 'Win 3 matches in a row', '🔥', 'streaks', 'streak', 3, 250),
    ('win_streak_5', 'Unstoppable', 'Win 5 matches in a row', '⚡', 'streaks', 'streak', 5, 500),
    ('total_wins_10', 'Veteran', 'Win 10 total matches', '🎖️', 'wins', 'count', 10, 300),
    ('total_wins_50', 'Champion', 'Win 50 total matches', '👑', 'wins', 'count', 50, 1000),
    ('high_elo_1200', 'Skilled Player', 'Reach 1200 ELO rating', '📈', 'rating', 'rating', 1200, 400),
    ('high_elo_1500', 'Expert Player', 'Reach 1500 ELO rating', '🌟', 'rating', 'rating', 1500, 800),
    ('games_played_100', 'Dedicated', 'Play 100 total matches', '💪', 'games', 'count', 100, 500);
