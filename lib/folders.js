/* global Buffer */
var httpreq = require("httpreq");
var setAuth = require('./setAuth');
var Q = require('q');
var util = require("util");

var _httprequest, _digestValue, _options, _webUrl, _onPrem, _auth;

function checkAndCreateIfNotExist(webUrl, options, digestValue, auth, httprequest, onPrem, cb){
	console.log('checking path to exist: ' + options.folder);
	_webUrl = webUrl; _digestValue = digestValue; _onPrem = onPrem;
	_options = options; _auth = auth; _httprequest= httprequest;
	var folders = options.folder;
	var foldersArray = getFolderPathsArray(folders);
	var proms = [];
	foldersArray.forEach(function (val, index) {
		var getFolderUrl = util.format("/_api/web/GetFolderByServerRelativeUrl(@FolderName)" +
				"?@FolderName='%s'", encodeURIComponent(val));
			var opts = {
				headers: {
					"Accept": "application/json;odata=verbose",
					"X-RequestDigest": digestValue
				}
			};
			setAuth(options, auth, opts, onPrem);
			var def = Q.defer();
			httprequest.post(webUrl.href + getFolderUrl, opts, function(err, res){
				console.log('checking path to exist: ' + val);
					if (err) {
					console.log(JSON.stringify(err));
					return;
				} else {
					var data = JSON.parse(res.body);
					
					if (data.error) {
						console.log(JSON.stringify(data.error));
					} else {
						console.log('exists');
					}
					
					def.resolve(data);
				}
			})
			proms.push(def.promise);
	});
	
	Q.all(proms).then(function(data){
		var erroredIndexes = data.map(function(val, index){
			if (val.error){
				return index;
			}
		}).filter(function(x) {return x != undefined});
		var pathArray = [];
		erroredIndexes.forEach(function(val, index){
			var path = foldersArray[val];
			pathArray.push(path);
		})
		if (pathArray.length > 0){
			createPath(pathArray).then(function(){
				cb(_webUrl, _options, _digestValue, _auth);
			});
		} else {
			cb(_webUrl, _options, _digestValue, _auth);
		}		
	})
	
}

function createPath(path, def){ //recursive folder create method
	if (!def) def = Q.defer();
	if (path.length > 0){
		console.log('inside createpath: ' + path[0]);
	var setFolder = util.format("/_api/web/folders");
	var body = "{'__metadata': {'type': 'SP.Folder'}, 'ServerRelativeUrl': '"+ path[0] +"'}";
	var opts = {
				headers: {
					"Accept": "application/json;odata=verbose",
					"X-RequestDigest": _digestValue,
					"content-type": "application/json;odata=verbose",
					"content-length": Buffer.byteLength(body)
				},
				body: body
			};
	setAuth(_options, _auth, opts, _onPrem);
	_httprequest.post(_webUrl.href + setFolder, opts, function (err, res) {
		console.log('inside createpath httprequest: ' + path);
			if (err) {
				console.log('create '+ path +' error:' + JSON.stringify(err));
				return;
			} else {
				var data = JSON.parse(res.body);

				if (data.error) {
					console.log('create '+ path +' error: ' + JSON.stringify(data.error));
					return;
				} else {
					console.log('created path: '+ path);
					createPath(path.slice(1, path.length), def);
				}
			}
		});
	} else {
		def.resolve()
	} 
	
	return def.promise;
}

function getFolderPathsArray(folder) {
	var folderNamesArray = folder.split('/');
	var foldersArray = [];
	for (var i = 0; i < folderNamesArray.length; i++) {
		var pathArray = [];
		for (var r = 0; r <= i; r++) {
			pathArray.push(folderNamesArray[r]);
		}
		foldersArray.push(pathArray.join('/'));
	}
	return foldersArray;
}


module.exports = {
	checkAndCreateIfNotExist: checkAndCreateIfNotExist,
	getFolderPathsArray: getFolderPathsArray
};