-- Runs once when the docker-compose MySQL container is first created.
CREATE DATABASE IF NOT EXISTS chang_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON chang_test.* TO 'chang_app'@'%';
