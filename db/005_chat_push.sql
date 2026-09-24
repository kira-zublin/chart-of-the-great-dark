-- Link pushed rolls to their previous result. One continuation per roll.
ALTER TABLE chat_messages ADD COLUMN push_of INTEGER REFERENCES chat_messages(id);
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_push_of_idx ON chat_messages(push_of) WHERE push_of IS NOT NULL;
