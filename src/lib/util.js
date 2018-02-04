const VERBOSE = 2;
const DEBUG = VERBOSE >= 2;
const INFO = VERBOSE >= 1;

/**	Creates a callback that proxies node callback style arguments to an Express Response object.
 *	@param {express.Response} res	Express HTTP Response
 *	@param {number} [status=200]	Status code to send on success
 *
 *	@example
 *		list(req, res) {
 *			collection.find({}, toRes(res));
 *		}
 */
export function toRes(res, status=200) {
  return (err, thing) => {
    if (err) {
      return res.status(500).send(err);
    }

    if (thing && typeof thing.toObject==='function') {
      thing = thing.toObject();
    }
    res.status(status).json(thing);
  };
}

export const logger = {
  overview: function(msg, extraCondition = true) {
    if (extraCondition) {
      console.log(`===> OVERVIEW: ${msg}`); // eslint-disable-line
    }
  },
  info: function(msg, extraCondition = true) {
    if (INFO && extraCondition) {
      console.log(`===> INFO: ${msg}`); // eslint-disable-line
    }
  },
  debug: function(msg, extraCondition = true) {
    if (DEBUG && extraCondition) {
      console.log(`===> DEBUG: ${msg}`); // eslint-disable-line
    }
  }
};