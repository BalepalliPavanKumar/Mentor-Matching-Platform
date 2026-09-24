#!/bin/sh
set -eu

for db in \
  skillsync_auth \
  skillsync_user \
  skillsync_mentor \
  skillsync_skill \
  skillsync_session \
  skillsync_notification \
  skillsync_group \
  skillsync_review_db
do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-SQL
    CREATE DATABASE "$db";
SQL
done
