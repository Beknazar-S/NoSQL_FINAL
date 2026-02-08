function auth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function adminOnly(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (req.session.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

module.exports = { auth, adminOnly };
