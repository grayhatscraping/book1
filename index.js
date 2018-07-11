const _ = require('lodash');
const async = require('async');
const request = require('request').defaults({jar: true}); // This jar setting will become important in the next eBook
const cheerio = require('cheerio');
const mysql = require('mysql');
const pool = mysql.createPool({
	connectionLimit: 30,
	host: 'myserverhost.com',
	user: 'username',
	password: 'password',
	database: 'db'
});

let requestDelay = 3600; // How long in between record requests
let requestTimeout = 6000; // How long we should wait after a request is made before erroring out

let agent_id = 0;
async.whilst(
	function() {
		return agent_id < 20000000; // Setting an arbitrary limit for the agent ids
	},
	function(next) {
		agent_id++;
		setTimeout(function() {
			let url = 'https://www.mid.ms.gov/licensing-search/agent-search-results.aspx?ID=' + agent_id;
			request({
				url: url,
				rejectUnauthorized: false, 
				timeout: requestTimeout
			}, function(err, res, body) {
				if (err) {
					console.error('Error with agent_id ' + agent_id, err);
					return next(); // We still want to continue scraping even if there's an error, so we don't return an error in the callback
				}
				else {
					let $ = cheerio.load(body);
					pool.query('INSERT INTO agents SET ?', [{
					  agent_id: agent_id,
					  national_producer_id: $('#maincontent_pagecontent_Label11').text().trim(),
					  name: $('#maincontent_pagecontent_Label1').text().trim(),
					  mailing_address: $('#maincontent_pagecontent_Label4').text().trim(),
					  phone: $('#maincontent_pagecontent_Label8').text().trim(),
					  license: $('#maincontent_pagecontent_Datagrid2').text().trim(), // We're storing the *entire* table, because we don't know the full formatting.  We can correct in post-processing
					  qualifications: $('#maincontent_pagecontent_Datagrid3').text().trim() // Same thing here
					}], function(err) {
						if (err) {
							console.error('Problem storing the record in MySQL', err);
						}
						console.log('Retrieved ' + agent_id);
						return next();
					});
				}
			});
		}, requestDelay);
	},
	function(err) {
		if (err) {
			return console.error('Quit with an error', err); // You should never receive this, as we haven't returned an error inside of the whilst function
		}
		return console.log('Completed the scrape!');
	}
);
