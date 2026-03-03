// backend/controllers/cloudController.js
const qs = require("querystring");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

exports.getGoogleAuthUrl = async (req, res) => {
  try {
    const client_id = requireEnv("GOOGLE_CLIENT_ID");
    const redirect_uri = requireEnv("GOOGLE_REDIRECT_URI"); // e.g. http://localhost:5000/api/cloud/google/callback
    const scope = [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ].join(" ");

    const params = {
      client_id,
      redirect_uri,
      response_type: "code",        // ✅ REQUIRED
      scope,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: String(req.user?._id || ""), // optional
    };

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify(params)}`;
    return res.json({ url });
  } catch (e) {
    return res.status(500).json({ message: "Failed to build Google auth URL", error: e.message });
  }
};

exports.getDropboxAuthUrl = async (req, res) => {
  try {
    const client_id = requireEnv("DROPBOX_CLIENT_ID");
    const redirect_uri = requireEnv("DROPBOX_REDIRECT_URI"); // e.g. http://localhost:5000/api/cloud/dropbox/callback

    const params = {
      client_id,                   // ✅ REQUIRED
      redirect_uri,
      response_type: "code",       // ✅ REQUIRED
      token_access_type: "offline",
      state: String(req.user?._id || ""),
    };

    const url = `https://www.dropbox.com/oauth2/authorize?${qs.stringify(params)}`;
    return res.json({ url });
  } catch (e) {
    return res.status(500).json({ message: "Failed to build Dropbox auth URL", error: e.message });
  }
};

exports.getOneDriveAuthUrl = async (req, res) => {
  try {
    const client_id = requireEnv("ONEDRIVE_CLIENT_ID");
    const redirect_uri = requireEnv("ONEDRIVE_REDIRECT_URI"); // e.g. http://localhost:5000/api/cloud/onedrive/callback

    const params = {
      client_id,
      redirect_uri,
      response_type: "code", // ✅ REQUIRED
      response_mode: "query",
      scope: [
        "offline_access",
        "User.Read",
        "Files.ReadWrite",
      ].join(" "),
      state: String(req.user?._id || ""),
    };

    // Use "consumers" for personal Microsoft accounts
    const tenant = process.env.ONEDRIVE_TENANT || "consumers";
    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${qs.stringify(params)}`;
    return res.json({ url });
  } catch (e) {
    return res.status(500).json({ message: "Failed to build OneDrive auth URL", error: e.message });
  }
};