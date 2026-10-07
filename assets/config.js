/*
  PROVIDETECH site settings
  -------------------------
  Connected to the PROVIDETECH Supabase project (Singapore).

  This "anon" key is meant to be public: it ships in every visitor's browser.
  The database rules in supabase/schema.sql decide what it can do. Visitors
  can only list open workshops, reserve a seat and send an inquiry.

  NEVER put the service_role key or any secret key in this file.

  To go back to DEMO MODE (sample data in your browser), empty both values.
*/
window.PROVIDETECH_CONFIG = {
  supabaseUrl: "https://bfojtvszuvhajmwfkapk.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmb2p0dnN6dXZoYWptd2ZrYXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNzMwNzEsImV4cCI6MjEwNjg0OTA3MX0.sCU_AVat1_4UmXb4TylydipxKZSQsvondh5WEGnMBCY"
};
