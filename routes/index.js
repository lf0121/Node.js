var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.redirect('/Test_html.html')
  // res.send("<h1>index</h1>");
});
router.get('/f', function(req, res, next) {
  res.redirect('/Test_from.html')
});

module.exports = router;
