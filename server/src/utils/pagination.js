'use strict';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Parse `page` / `limit` query params into safe SQL bounds.
 * Returns `{ page, limit, offset }`.
 */
function parsePagination(query) {
  let page = Number.parseInt(query.page, 10);
  let limit = Number.parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit, offset: (page - 1) * limit };
}

function buildPage({ rows, total, page, limit }) {
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit)
    }
  };
}

module.exports = { parsePagination, buildPage, MAX_LIMIT, DEFAULT_LIMIT };
