-- ============================================================
-- Student Job and Internship Opportunity Portal (PostgreSQL)
-- Matches the project documentation (Sections 4 to 8): 18 tables
-- ============================================================

-- ---------- Enum types ----------
CREATE TYPE user_role AS ENUM ('student', 'employer', 'admin', 'coordinator');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'inactive', 'suspended');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE opportunity_type AS ENUM ('job', 'internship', 'ojt');
CREATE TYPE work_setup AS ENUM ('onsite', 'remote', 'hybrid');
CREATE TYPE opportunity_status AS ENUM ('draft', 'pending_approval', 'open', 'closed', 'filled');

-- Workflow: Submitted > Under review > Shortlisted > Interview > Offered > Hired.
-- rejected, declined and withdrawn are the "Closed" outcomes in the workflow diagram.
CREATE TYPE application_status AS ENUM (
    'submitted', 'under_review', 'shortlisted', 'interview',
    'offered', 'hired', 'rejected', 'declined', 'withdrawn'
);

CREATE TYPE interview_mode AS ENUM ('onsite', 'online', 'phone');
CREATE TYPE interview_result AS ENUM ('pending', 'passed', 'failed', 'no_show', 'cancelled');
CREATE TYPE application_file_type AS ENUM (
    'resume', 'cover_letter', 'endorsement_letter', 'moa', 'grades', 'other'
);
CREATE TYPE analytics_event_type AS ENUM ('view', 'search', 'apply');
CREATE TYPE notification_type AS ENUM (
    'new_match', 'status_change', 'deadline', 'approval', 'message', 'announcement'
);

-- ---------- Core tables ----------
CREATE TABLE programs (
    program_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_name  VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE users (
    user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           user_role NOT NULL,
    status         user_status NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- users 1:1 students
CREATE TABLE students (
    student_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE
                    REFERENCES users(user_id) ON DELETE CASCADE,
    program_id      BIGINT NOT NULL
                    REFERENCES programs(program_id) ON DELETE RESTRICT,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    student_number  VARCHAR(50) NOT NULL UNIQUE,
    year_level      SMALLINT NOT NULL CHECK (year_level BETWEEN 1 AND 10),
    availability    DATE            -- date the student is available to start
);

-- users 1:1 employers
CREATE TABLE employers (
    employer_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              BIGINT NOT NULL UNIQUE
                         REFERENCES users(user_id) ON DELETE CASCADE,
    company_name         VARCHAR(200) NOT NULL,
    industry             VARCHAR(100),
    address              TEXT,
    contact_person       VARCHAR(150),
    verification_status  verification_status NOT NULL DEFAULT 'pending'
);

-- employers 1:N opportunities
CREATE TABLE opportunities (
    opportunity_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employer_id       BIGINT NOT NULL
                      REFERENCES employers(employer_id) ON DELETE CASCADE,
    program_id        BIGINT
                      REFERENCES programs(program_id) ON DELETE SET NULL,  -- target program
    type              opportunity_type NOT NULL,
    title             VARCHAR(200) NOT NULL,
    description       TEXT,
    requirements      TEXT,
    location          VARCHAR(200),
    work_setup        work_setup,
    allowance_salary  NUMERIC(12,2) CHECK (allowance_salary >= 0),
    slots             INTEGER NOT NULL DEFAULT 1 CHECK (slots >= 0),
    deadline          TIMESTAMPTZ,
    status            opportunity_status NOT NULL DEFAULT 'draft',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- students 1:N applications, opportunities 1:N applications
-- RESTRICT on opportunity: close a posting instead of deleting it, so analytics stay intact
CREATE TABLE applications (
    application_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id      BIGINT NOT NULL
                    REFERENCES students(student_id) ON DELETE CASCADE,
    opportunity_id  BIGINT NOT NULL
                    REFERENCES opportunities(opportunity_id) ON DELETE RESTRICT,
    cover_letter    TEXT,
    current_status  application_status NOT NULL DEFAULT 'submitted',
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, opportunity_id)  -- one application per student per opportunity
);

-- students 1:N resumes
CREATE TABLE resumes (
    resume_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id   BIGINT NOT NULL
                 REFERENCES students(student_id) ON DELETE CASCADE,
    file_name    VARCHAR(255) NOT NULL,
    file_path    TEXT NOT NULL,
    file_type    VARCHAR(10) NOT NULL CHECK (file_type IN ('pdf', 'docx')),
    file_size    INTEGER NOT NULL CHECK (file_size > 0),
    is_default   BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- at most one default resume per student
CREATE UNIQUE INDEX uq_resumes_default ON resumes(student_id) WHERE is_default;

-- applications 1:N application_files, resumes 1:N application_files
CREATE TABLE application_files (
    file_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id  BIGINT NOT NULL
                    REFERENCES applications(application_id) ON DELETE CASCADE,
    resume_id       BIGINT
                    REFERENCES resumes(resume_id) ON DELETE SET NULL,
    file_type       application_file_type NOT NULL,
    file_path       TEXT NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- applications 1:N application_status_log
CREATE TABLE application_status_log (
    log_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id  BIGINT NOT NULL
                    REFERENCES applications(application_id) ON DELETE CASCADE,
    status          application_status NOT NULL,
    changed_by      BIGINT
                    REFERENCES users(user_id) ON DELETE SET NULL,
    remarks         TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- applications 1:N interviews
CREATE TABLE interviews (
    interview_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id  BIGINT NOT NULL
                    REFERENCES applications(application_id) ON DELETE CASCADE,
    schedule        TIMESTAMPTZ NOT NULL,
    mode            interview_mode NOT NULL,
    link_or_venue   TEXT,
    result          interview_result NOT NULL DEFAULT 'pending'
);

-- ---------- Skills (admin-managed lookup, used for matching and in-demand-skill analytics) ----------
CREATE TABLE skills (
    skill_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    skill_name  VARCHAR(100) NOT NULL UNIQUE
);

-- students N:M skills
CREATE TABLE student_skills (
    student_id  BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    skill_id    BIGINT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, skill_id)
);

-- opportunities N:M skills
CREATE TABLE opportunity_skills (
    opportunity_id  BIGINT NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
    skill_id        BIGINT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    PRIMARY KEY (opportunity_id, skill_id)
);

-- Student bookmarks
CREATE TABLE saved_opportunities (
    student_id      BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    opportunity_id  BIGINT NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
    saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, opportunity_id)
);

-- In-app notifications (email alerts are sent by the application)
CREATE TABLE notifications (
    notification_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type             notification_type NOT NULL,
    message          TEXT NOT NULL,
    is_read          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employer-student messaging, tied to an application
CREATE TABLE messages (
    message_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id  BIGINT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    sender_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (sender_id <> receiver_id)
);

-- Audit trail of admin and user actions
CREATE TABLE activity_logs (
    log_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    action      VARCHAR(200) NOT NULL,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feeds the analytics module (views, searches, applications)
CREATE TABLE analytics_events (
    event_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    opportunity_id  BIGINT REFERENCES opportunities(opportunity_id) ON DELETE SET NULL,
    event_type      analytics_event_type NOT NULL,
    search_terms    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Keep current_status and the status log in sync ----------
-- The app can run: SET LOCAL app.user_id = '<id>'; before updating, so changed_by is recorded.
CREATE FUNCTION log_application_status() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.current_status IS DISTINCT FROM OLD.current_status THEN
        INSERT INTO application_status_log (application_id, status, changed_by)
        VALUES (NEW.application_id, NEW.current_status,
                NULLIF(current_setting('app.user_id', true), '')::BIGINT);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_application_status_log
AFTER INSERT OR UPDATE OF current_status ON applications
FOR EACH ROW EXECUTE FUNCTION log_application_status();

-- ---------- Indexes on foreign keys and common filters ----------
CREATE INDEX idx_students_program         ON students(program_id);
CREATE INDEX idx_opportunities_employer   ON opportunities(employer_id);
CREATE INDEX idx_opportunities_program    ON opportunities(program_id);
CREATE INDEX idx_opportunities_status     ON opportunities(status, deadline);
CREATE INDEX idx_opportunities_type       ON opportunities(type);
CREATE INDEX idx_applications_student     ON applications(student_id);
CREATE INDEX idx_applications_opportunity ON applications(opportunity_id);
CREATE INDEX idx_applications_status      ON applications(current_status);
CREATE INDEX idx_resumes_student          ON resumes(student_id);
CREATE INDEX idx_app_files_application    ON application_files(application_id);
CREATE INDEX idx_app_files_resume         ON application_files(resume_id);
CREATE INDEX idx_status_log_application   ON application_status_log(application_id, changed_at);
CREATE INDEX idx_interviews_application   ON interviews(application_id);
CREATE INDEX idx_events_type_date         ON analytics_events(event_type, created_at);
CREATE INDEX idx_events_opportunity       ON analytics_events(opportunity_id);
CREATE INDEX idx_student_skills_skill     ON student_skills(skill_id);
CREATE INDEX idx_opp_skills_skill         ON opportunity_skills(skill_id);
CREATE INDEX idx_saved_opportunity        ON saved_opportunities(opportunity_id);
CREATE INDEX idx_notifications_user       ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_messages_application     ON messages(application_id, sent_at);
CREATE INDEX idx_messages_receiver        ON messages(receiver_id);
CREATE INDEX idx_activity_user_date       ON activity_logs(user_id, created_at);
