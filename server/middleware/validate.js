import { validationResult } from "express-validator";
import { httpError } from "../utils/httpError.js";

export function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  throw httpError(400, errors[0].message, errors);
}
