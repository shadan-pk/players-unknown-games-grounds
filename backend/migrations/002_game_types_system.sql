-- Enhanced game_types table with more detailed configuration
CREATE TABLE game_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_players INTEGER NOT NULL DEFAULT 2,
    max_players INTEGER NOT NULL DEFAULT 2,
    estimated_duration INTERVAL DEFAULT '5 minutes',
    difficulty_level VARCHAR(20) DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    is_active BOOLEAN DEFAULT true,
    icon VARCHAR(100), -- For frontend icons/images
    rules TEXT, -- Game rules explanation
    tags TEXT[], -- Categories like 'strategy', 'quick', 'classic'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Game configuration table for flexible game settings
CREATE TABLE game_configurations (
    game_type_id VARCHAR(50) REFERENCES game_types(id),
    config_key VARCHAR(100),
    config_value JSONB,
    description TEXT,
    PRIMARY KEY (game_type_id, config_key)
);

-- Insert initial game types
INSERT INTO game_types (id, name, description, min_players, max_players, estimated_duration, difficulty_level, icon, rules, tags) VALUES
    ('tictactoe', 'Tic Tac Toe', 'Classic 3x3 grid game where you try to get three in a row', 2, 2, '3 minutes', 'easy', '⭕', 'Take turns placing X or O on a 3x3 grid. First to get three in a row wins!', ARRAY['classic', 'quick', 'simple']),
    ('checkers', 'Checkers', 'Strategic board game with jumping and capturing', 2, 2, '15 minutes', 'medium', '🔴', 'Move your pieces diagonally and jump over opponents to capture them. Get your pieces to the other end to become kings!', ARRAY['strategy', 'classic', 'board']),
    ('chess', 'Chess', 'Ultimate strategy game with different piece types', 2, 2, '30 minutes', 'hard', '♔', 'The most popular strategy game. Checkmate your opponent''s king using various pieces with unique movement patterns.', ARRAY['strategy', 'classic', 'complex']),
    ('connect4', 'Connect Four', 'Drop pieces to connect four in a row', 2, 2, '8 minutes', 'easy', '🔵', 'Take turns dropping colored pieces into columns. First to get four pieces in a row (horizontally, vertically, or diagonally) wins!', ARRAY['quick', 'family', 'simple']);

-- Insert game configurations
INSERT INTO game_configurations (game_type_id, config_key, config_value, description) VALUES
    ('tictactoe', 'board_size', '{"rows": 3, "cols": 3}', 'Board dimensions'),
    ('tictactoe', 'win_condition', '{"type": "line", "count": 3}', 'Winning condition'),
    ('checkers', 'board_size', '{"rows": 8, "cols": 8}', 'Board dimensions'),
    ('checkers', 'piece_count', '{"per_player": 12}', 'Starting pieces per player'),
    ('chess', 'board_size', '{"rows": 8, "cols": 8}', 'Board dimensions'),
    ('chess', 'time_control', '{"enabled": false, "minutes": 10}', 'Time control settings'),
    ('connect4', 'board_size', '{"rows": 6, "cols": 7}', 'Board dimensions'),
    ('connect4', 'win_condition', '{"type": "line", "count": 4}', 'Winning condition');

-- Create indexes
CREATE INDEX idx_game_types_active ON game_types(is_active);
CREATE INDEX idx_game_types_difficulty ON game_types(difficulty_level);
CREATE INDEX idx_game_types_tags ON game_types USING GIN(tags);
