(function($) {
	
	var trim = function(token) {
		return token.replace(/\s+$/, '').replace(/^\s+/, '');
	}
	
	var TokenStream = function(str) {
		this.str = str;
		this.inputStrLen = str.length;
	}
	
	TokenStream.prototype.idx = 0;

	TokenStream.prototype.inputStrLen = 0;
	
	TokenStream.prototype.lineIdx = 1;
	
	TokenStream.prototype.currentContext = 'html';
	
	TokenStream.prototype.read = function() {
		var str = this.str;
		this.currentContext = 'html';
		var token = '';
		var next = null;
		if ( this.idx >= this.inputStrLen )
			return null;
			
		var chr = str[this.idx];
		if ( chr == '$' ) {
			if ( (next = this.nextChar()) !== '{' ) {
				this.invalidChar( next );
			}
			this.currentContext = 'output';
			this.idx += 2;
		} else if ( chr == '{' ) {
			if ( (next = this.nextChar()) !== '{' ) {
				this.invalidChar( next );
			}
			this.currentContext = 'stmt';
			this.idx += 2;
		} else { // handling HTML context in a different loop for faster execution
			for (; this.idx < this.inputStrLen; ++this.idx) {
				chr = str[this.idx];
			
				switch( chr ) {
					case "\n":
						++this.lineIdx;
						break;
					case '$':
					case '{':
						if ( (next = this.nextChar()) === '{' ) {
							return {
								type: this.currentContext,
								token: token
							};
						}
				}
				token += chr;
			}
			return {
				type: this.currentContext,
				token: token
			};
		}
		for (; this.idx < this.inputStrLen; ++this.idx) { // reading stmt and output context
			chr = str[this.idx];
			
			switch( chr ) {
				case "\n":
					++this.lineIdx;
					break;
				case "{":
					if ( this.currentContext !== 'html' ) {
						this.invalidChar( chr );
					}
					break;
				case "}":
					if ( this.currentContext == 'stmt') {
						if ( (next = this.nextChar()) !== '}' ) {
							this.invalidChar( chr );
						}
						this.idx += 2;
						return {
							type: this.currentContext,
							token: trim(token)
						};
						
					} else if ( this.currentContext == 'output' ) {
						++this.idx;
						return {
							type: this.currentContext,
							token: trim(token)
						};
					}
			}
			
			token += chr;
		}
		this.raiseError("incomplete expression at the end of template");
	}
	
	TokenStream.prototype.readAll = function() {
		var rval = new Array();
		var token = null;
		while ( (token = this.read()) !== null ) {
			rval.push(token);
		}
		return rval;
	}
	
	TokenStream.prototype.nextChar = function() {
		if ( this.idx >= this.inputStrLen - 1 )
			return null;
		return this.str[this.idx + 1];
	}
	
	TokenStream.prototype.invalidChar = function(chr) {
		throw "invalid character '" + chr + "' at line " + this.lineIdx;
	}
	
	TokenStream.prototype.raiseError = function(message) {
		throw message + " at line " + this.lineIdx;
	}
	
	var NodeController = function() {
		
	};
	
	NodeController.factory = function(tokenObj, tokenstream) {
		switch( tokenObj.type ) {
			case 'html':
				return new HTMLNodeController( tokenObj, tokenstream );
			case 'output':
				return new OutputNodeController( tokenObj, tokenstream );
			case 'stmt':
				return StatementNodeController.factory( tokenObj, tokenstream );
			default:
				throw "unknown token type: " + tokekObj.type;
		}
	};
	
	var HTMLNodeController = function( tokenObj, tokenstream ) {
		this.block = [ tokenObj.token ];
	};
	
	HTMLNodeController.prototype = new NodeController();
	
	HTMLNodeController.prototype.block = null;
	
	var OutputNodeController = function( tokenObj, tokenstream ) {
		this.expression = new Expression(tokenObj);
		
	};
	
	OutputNodeController.prototype = new NodeController();
	
	var StatementNodeController = function() {};
	
	StatementNodeController.prototype.block = [];
	
	StatementNodeController.factory = function( tokenObj, tokenstream ) {
		var str = tokenObj.token;
		var firstSpacePos = str.indexOf(" ");
		var stmtWord = str.substr(0, firstSpacePos);
		var remaining = str.substr(firstSpacePos);
		switch( stmtWord ) {
			case 'if':
				return new IfStatementNodeController( remaining, tokenstream );
			case 'elseif':
			case 'elif':
			case 'elsif':
				return new ElseIfStatementNodeController( remaining, tokenstream );
			case 'else':
				return new ElseStatementNodeController( remaining, tokenstream );
			case 'each':
				return new EachStatementNodeController( remaining, tokenstream );
		}
	}
	
	StatementNodeController.prototype = new NodeController();
	
	var IfStatementNodeController = function( condition, tokenstream ) {
		
	}
	
	IfStatementNodeController.prototype = new StatementNodeController();
	
	var ElseIfStatementNodeController = function( condition, tokenstream ) {
		
	}
	
	ElseIfStatementNodeController.prototype = new StatementNodeController();
	
	var ElseStatementNodeController = function( remaining, tokenstream ) {
		if (remaining)
			tokenstream.raiseError("unexpected '" + remaining + "'");
		this.block = readTree(tokenstream, {type: 'stmt', token: '/if'}
			, [{type: 'stmt', token: '/each'}]);
	}
	
	ElseStatementNodeController.prototype = new StatementNodeController();
	
	
	
	var readTree = function(tokenstream, data, readUntil, disabledTokens) {
		if ( undefined === readUntil ) {
			readUntil = null;
		}
		var token;
		var rval = [];
		if ( ! disabledTokens ) {
			while ( (token = tokenstream.read()) !== null ) { // no disabled tokens, simple reading
				if (token === readUntil)
					break;
				rval.push( NodeController.factory(token, tokenstream, data) );
			}
		} else {
			if ( ! $.isArray(disabledTokens) )
				throw "disabledTokens must be an array or null";
			
			while ( (token = tokenstream.read()) !== null ) { // no disabled tokens, simple reading
				if (token === readUntil)
					break;
				for (var i = 0; i < disabledTokens.length; ++i ) {
					if (disabledToken[ i ] == token) {
						tokenstream.raiseError("unexpected " + token);
					}
				}
				rval.push( NodeController.factory(token, tokenstream, data) );
			}
		}
		return rval;
	}
	
	$.fn.binddata = function(data) {
		readTree(new TokenStream(this[0].innerHTML), data);
	}
	
	var Expression = function( expr ) {
		var compiledExpr = Expression.buildExprFn( trim(expr) );
		if ( compiledExpr === null )
			throw "failed to compile expression '" + expr + "'";
		this.fn = compiledExpr.fn;
		if ( compiledExpr.dependencies ) { // literal expressions will never have dependencies
			this.dependencies = compiledExpr.dependencies;
		}
	};
	
	Expression.buildExprFn = function( expr ) {
		if (expr.charAt(0) == '(') {
			if (expr.charAt(expr.length - 1) !== ')') {
				throw "missing closing bracket in expression '" + expr + "'";
			}
			var simpleExpr = trim( expr.substr(1, expr.length - 2) );
			return Expression.buildSimpleExpr( simpleExpr );
		}
		return Expression.buildSimpleExpr( trim(expr) );
	}
	
	Expression.buildSimpleExpr = function( expr ) {
		var builders = [Expression.buildLiteralExpr
			, Expression.buildVariableExpr];
		for ( var i = 0; i < builders.length; ++i ) {
			var candidate = builders[ i ] ( expr );
			if (candidate !== null )
				return candidate;
		}
		return null;
	};
	
	Expression.buildLiteralExpr = function( expr ) {
		var literalBuilders = [Expression.buildNullLiteralExpr
			, Expression.buildStringLiteralExpr
			, Expression.buildBooleanLiteralExpr
			, Expression.buildNumberLiteralExpr];
		for ( var i = 0; i < literalBuilders.length; ++i ) {
			var candidate = literalBuilders[i] ( expr );
			if (candidate !== null)
				return {
					fn: candidate,
				};
		}
		return null;
	}
	
	Expression.buildStringLiteralExpr = function( expr ) {
		var firstChar = expr.charAt(0);
		var lastChar = expr.charAt(expr.length - 1);
		if ( (firstChar === '"' && lastChar === '"')
			|| (firstChar === "'" && lastChar === "'") ) {
			
			var terminator = firstChar;
			var escaped = false;
			for (var i = 1; i < expr.length - 1; ++i ) {
				var chr = expr.charAt(i);
				if ( chr === '\\' ) {
					escaped = ! escaped;
					continue;
				}
				if ( chr === terminator && ! escaped ) { // an unescaped string identifier found in the middle of the string - it can't be a string literal
					return null;
				}
			}
			var rval = expr.substr(1, expr.length - 2);
			return function() {
				return rval;
			}
		} else {
			return null;
		}
	}
	
	Expression.buildNullLiteralExpr = function(expr) {
		if (expr.toLowerCase() !== 'null') // it's not a null literal
			return null;
		return function() {
			return null;
		}
	}
	
	Expression.buildBooleanLiteralExpr = function( expr ) {
		expr = expr.toLowerCase();
		if ( expr === 'true' ) {
			return function() {
				return true;
			}
		}
		if ( expr === 'false' ) {
			return function() {
				return false;
			}
		}
		return null;
	}
	
	Expression.buildNumberLiteralExpr = function( expr ) {
		var candidate = new Number(expr);
		if ( isNaN(candidate) )
			return null;
		return function() {
			return candidate;
		}
	}
	
	
	Expression.buildVariableExpr = function( expr ) {
		if ( ! /[a-zA-Z_][a-zA-Z0-9_]*(\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]*)*/.test(expr) )
			return null;
		
		var propChain = expr.split('.');
		for ( var i = 0; i < propChain.length; ++i ) {
			propChain[ i ] = trim(propChain[ i ]);
		}
		
		return {
			fn: function(data) {
				var currObj = data;
				for ( var i = 0; i < propChain.length; ++i ) {
					var candidate = currObj() [ propChain[ i ] ];
					if (candidate === undefined)
						return undefined;
					currObj = candidate;
				}
				return currObj;
			},
			dependencies: [propChain]
		};
	}
	
	Expression.prototype.fn = null;
	
	Expression.prototype.evaluate = function(data) {
		return this.fn(data);
	};
	
	Expression.prototype.dependencies = [];
		
	/**
	 * Exploding some classes for unit testing
	 */
	$.binddata = {
		TokenStream: TokenStream,
		Expression: Expression
	};
	
})(jQuery);
