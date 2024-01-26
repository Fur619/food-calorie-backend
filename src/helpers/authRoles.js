const ensureRole = (user, role) => {
  if (user?.role !== role) {
    return res.status(401).send({
      message: "Authentication Failed",
    });
  }
};
const ensureUser = (user) => {
  if (!user) {
    return res.status(401).send({
      message: "Authentication Failed",
    });
  }
};

// const ensureAuthorization = (user, userId) => {
//   if (userId !== user._id && user.role !== "Admin") {
//     throw new Error("Authentication required.");
//   }
// };
const ensureUserId = (user, id) => {
  if (!user) {
    return res.status(401).send({
      message: "Authentication Failed",
    });
  } else if (user.role !== "Admin" && user._id !== id) {
    return res.status(401).send({
      message: "You cant access other user record",
    });
  }
};
module.exports = { ensureRole, ensureUser, ensureUserId };
