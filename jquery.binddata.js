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
			
		var chr = str.charAt( this.idx );
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
				chr = str.charAt( this.idx );
			
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
	
	var UniqId = new (function() {
		var last = 0;
		
		this.next = function() {
			return ++last;
		};
	});
	
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
	
	NodeController.prototype.render = function( data ) {
		throw "not implemented ";
	};
	
	NodeController.prototype.minifyDependencies = function() {
		if (this.block) {
			var thisDeps = this.dependencies;
			for ( var i = 0; i < this.block.length; ++i ) {
				var node = this.block[i];
				var nodeNewDeps = [];
				for ( var j = 0; j < node.dependencies; ++j ) {
					var nodeDep = node.dependencies[ j ];
					var foundInThis = false;
					for ( var d = 0; d < thisDeps.length; ++d ) {
						var thisDep = thisDeps[ d ];
						if (thisDep.length > nodeDep.length) {
							nodeNewDeps.push(nodeDep);
							continue;
						}
						for (var p = 0; p = thisDep.length; ++d) {
							if (thisDep[ p ] != nodeDep[ p ]) {
								nodeNewDeps.push( nodeDep );
							}
						}
					}
				}
				node.dependencies = nodeNewDeps;
			}
		}
	}
	
	NodeController.prototype.init = function( data, rootContext ) {
		var uniqid = UniqId.next();
		var containerSelector = this.containerSelector = 'jquery-binddata-' + uniqid;
		var html = '<' + containerSelector + '>';
		html += this.render( data, 'init' );
		html += '</' + containerSelector + '>';
		
		if (this.block) {
			for (var i = 0; i < this.block.length; ++i) {
				this.block[ i ].init( data, rootContext );
			}
		}

		this.minifyDependencies();
		debug("root ctx: " + rootContext);
		var self = this;
		for (var i = 0; i < this.dependencies.length; ++i) {
				var d = data;
				var propchain = this.dependencies[ i ];
				for (var j = 0; j < propchain.length; ++j) {
					d = d() [propchain[ j ]];
				}
				//(propchain);
				d.on('change', function() {
					debug(propchain + " changed, rendering into " + containerSelector  + " :: " + self.render( data, 'render' ))
					debug('root context: ' + (typeof rootContext))
					debug("selected: " + $(containerSelector).html(self.render( data, 'render' )).length);
				});
		}
		return html;
	}
	
	NodeController.prototype.dependencies = [];
	
	var HTMLNodeController = function( tokenObj, tokenstream ) {
		this.block = [];
		this.rawHTML = tokenObj.token ;
	};
	
	HTMLNodeController.prototype = new NodeController();
	
	HTMLNodeController.prototype.block = null;
	
	
	HTMLNodeController.prototype.init = function( data ) {
		return this.rawHTML;
	}
	
	HTMLNodeController.prototype.render = function() {
		return this.rawHTML;
	}
	
	var OutputNodeController = function( tokenObj, tokenstream ) {
		this.expression = new Expression(tokenObj.token);
		this.dependencies = this.expression.dependencies;
		debug("OutputNode deps"); debug(this.dependencies)
	};
	
	OutputNodeController.prototype = new NodeController();
	
	OutputNodeController.prototype.render = function( data ) {
		var val = this.expression.evaluate( data );
		debug("rendering outputnode"); debug($.observable.remove(data))
		while ( $.isFunction( val ) ) {
			val = val();
		}
		return val;
	};
	
	var StatementNodeController = function() {};
	
	StatementNodeController.prototype.block = [];
	
	StatementNodeController.factory = function( tokenObj, tokenstream ) {
		var str = tokenObj.token;
		var firstSpacePos = str.indexOf(" ");
		if (firstSpacePos == -1) {
			var stmtWord = str;
			var remaining = "";
		} else {
			var stmtWord = str.substr(0, firstSpacePos);
			var remaining = str.substr(firstSpacePos);
		}
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
		throw "invalid statement tag " + tokenObj.token;
	}
	
	StatementNodeController.prototype = new NodeController();
	
	var IfStatementNodeController = function( condition, tokenstream ) {
		this.condition = new Expression( condition );
		this.dependencies = this.condition.dependencies;
		this.block = readTree(tokenstream, {}, [{type: 'stmt', token: '/if'}]);
		
		var elseIfNodesPassed = false;
		for (var i = 0; i < this.block.length; ++i) {
			var node = this.block[ i ];
			if (node instanceof ElseIfStatementNodeController) {
				elseIfNodesPassed = true;
				this.elseIfStatements.push( node );
			} else {
				if (elseIfNodesPassed) {
					this.elseBlock.push( node );
				} else {
					this.onTrueBlock.push( node );
				}
			};
		}
	}
	
	IfStatementNodeController.prototype = new StatementNodeController();
	
	IfStatementNodeController.prototype.onTrueBlock = [];
	
	IfStatementNodeController.prototype.elseIfStatements = [];
	
	IfStatementNodeController.prototype.elseBlock = [];
	
	IfStatementNodeController.prototype.render = function(data, blockRenderer) {
		if ( ! blockRenderer) {
			blockRenderer = 'init';
		}
		var html = '';
		var condition = this.condition.evaluate( data );
		while ( $.isFunction(condition) ) {
			condition = condition();
		}
		//debug(this.block);
		if (condition) {
			for (var i = 0; i < this.onTrueBlock.length; ++i) {
				html += this.onTrueBlock[i][blockRenderer]( data, blockRenderer );
			}
		} else {
			var found = false;
			for (var i = 0; i < this.elseIfStatements.length; ++i) {
				var elseIf = this.elseIfStatements[ i ];
				condition = elseIf.condition.evaluate( data );
				while ( $.isFunction(condition) ) {
					condition = condition();
				}
				if (condition) {
					found = true;
					html += elseIf [blockRenderer] (data, blockRenderer);
					break;
				}
			}
			if ( ! found ) { // no matching elseif found, running else block
				for (var i = 0; i < this.elseBlock.length; ++i) {
					html += this.elseBlock[i] [ blockRenderer ] (data, blockRenderer);
				}
			}
		}
		return html;
	};
	
	var ElseIfStatementNodeController = function( condition, tokenstream ) {
		this.condition = new Expression( condition );
		this.dependencies = this.condition.dependencies;
		this.block = readTree(tokenstream, {}, [{type: 'stmt', token: '/if'}
			, {type: 'stmt', token: 'else'}]);
	}
	
	ElseIfStatementNodeController.prototype = new StatementNodeController();
	
	ElseIfStatementNodeController.prototype.render = function(data, blockRenderer) {
		if ( ! blockRenderer) {
			blockRenderer = 'init';
		}
		var html = '';
		for (var i = 0; i < this.block.length; ++i) {
			html += this.block[ i ] [ blockRenderer ] (data, blockRenderer);
		}
		return html;
	}
	
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
		
		while ( (token = tokenstream.read()) !== null ) {
			if ( $.isArray( readUntil ) ) {
				var found = false;
				for ( var i = 0; i < readUntil.length; ++i ) {
					if (token.type == readUntil[ i ].type && token.token == readUntil[ i ].token )
						found = true;
				}
				if ( found ) {
					break;
				}
			} else if (readUntil && token.type == readUntil.type && token.token == readUntil.token)
				break;
			if ( $.isArray( disabledTokens ) ) {
				for (var i = 0; i < disabledTokens.length; ++i ) {
					if (disabledToken[ i ] == token) {
						tokenstream.raiseError("unexpected " + token);
					}
				}
			}
			rval.push( NodeController.factory(token, tokenstream, data) );
		}
		return rval;
	}
	
	$.fn.binddata = function(data) {
		
		this.each(function() {
			var nodes = readTree(new TokenStream(this.innerHTML), data);
			var html = '';
			for (var i = 0; i < nodes.length; ++i) {
				html += nodes[i] . init( data, this );
			};
			$(this).html( html );
		});
		
		return this;
	}
	
	var Expression = function( expr, dependencies ) {
		if ( $.isFunction( expr ) ) {
			if (undefined === dependencies)
				throw "dpendencies must be an array";
			this.fn = expr;
			this.dependencies = dependencies;
			return;
		}
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
				return Expression.buildSimpleExpr(expr)
				throw "missing closing bracket in expression '" + expr + "'";
			}
			var simpleExpr = trim( expr.substr(1, expr.length - 2) );
			return Expression.buildExprFn( simpleExpr );
		}
		return Expression.buildSimpleExpr(expr);
	}
	
	Expression.buildSimpleExpr = function( expr ) {
		var builders = [Expression.buildLiteralExpr
			, Expression.buildVariableExpr
			, Expression.buildOperatorExpr];
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
		if ( ! /^[a-zA-Z_][a-zA-Z0-9_]*(\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(expr) )
			return null;
		
		var propChain = expr.split('.');
		for ( var i = 0; i < propChain.length; ++i ) {
			propChain[ i ] = trim(propChain[ i ]);
		}
		
		return {
			fn: function(data) {
				var currObj = data;
				for ( var i = 0; i < propChain.length; ++i ) {
					if ( ! $.isFunction( currObj ) )
						throw "failed to evaluate expression: '" + expr + "'";
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

	Expression.buildOperatorExpr = function( expr ) {
		var builders = [Expression.buildUnaryOperatorExpr, Expression.buildBinaryOperatorExpr];
		for ( var i = 0; i < builders.length; ++i ) {
			var candidate = builders[i] ( expr );
			if ( candidate !== null ) {
				return candidate;
			}
		}
		return null;
	};
	
	Expression.buildUnaryOperatorExpr = function( expr ) {
		var operandExpr = null;
		if ( expr.charAt(0) == '!' ) {
			operandExpr = expr.substr(1);
		} else if (expr.substr(0, 4) == 'not ') {
			operandExpr = trim(expr.substr(4));
		}
		if (null === operandExpr)
			return null;
			
		var operand = new Expression( operandExpr );
		
		return  {
			fn: function(data) {
				return ! operand.evaluate( data );
			},
			dependencies: operand.dependencies
		};
	};
	
	Expression.buildBinaryOperatorExpr = function( expr ) {
		var openBracketCount = 0;
		var stringCloseChr = null;
		var escaped = false;
		var currentOperand = '';
		var operands = [];
		var operators = [];
		for ( var i = 0; i < expr.length; ++i ) {
			
			var chr = expr.charAt(i);
			
			if (chr == '(' && stringCloseChr === null) {
				++openBracketCount;
				currentOperand += chr;
				continue;
			}
			if (chr === ')' && stringCloseChr === null) {
				--openBracketCount;
				currentOperand += chr;
				continue;
			}
			if ( (chr === '"' || chr === "'") ) {
				currentOperand += chr;
				if ( stringCloseChr !== null ) { // we are in a string
					if ( chr === stringCloseChr ) {
						if ( escaped ) {
							escaped = false;
						} else {
							stringCloseChr = null;
						}
						continue;
					} else {
						escaped = false;
						continue;
					}
				} else {
					escaped = false;
					stringCloseChr = chr;
					continue;
				}
			}
			if ( chr == '\\' ) {
				currentOperand += chr;
				escaped = ! escaped;
				continue;
			}
			if ( openBracketCount > 0 ) {
				currentOperand += chr;
				continue;
			}
			var foundOperator = null;
			for (var j = 0; j < Expression.binaryOperators.length; ++j ) {
				var operator = Expression.binaryOperators[j];
				foundOperator = operator;
				for ( var opCharIdx = 0; opCharIdx < operator.length; ++opCharIdx ) {
					if (expr.length > (i + opCharIdx) 
							&& expr.charAt(i + opCharIdx) == operator.charAt(opCharIdx) ) {
						continue;
					}
					foundOperator = null;
				}
				if ( foundOperator !== null ) {
					foundOperator = operator;
					i += foundOperator.length - 1;
					break;
				}
			}
			
			if (foundOperator === null) {
				currentOperand += chr;
			} else {
				operands.push( currentOperand );
				operators.push( foundOperator );
				currentOperand = '';
			}
		}
		if (currentOperand !== '') {
			operands.push(currentOperand);
		}
		if (operands.length != operators.length + 1)
			throw "failed to compile expression '" + expr + "'";
			
		for ( i = 0; i < Expression.operatorPrecedence.length; ++i ) {
			var opsUnderResolv = Expression.operatorPrecedence[i];
			var operatorMatchFound = false;
			for (var operatorIdx = 0
					; operatorIdx < operators.length
					; ++operatorIdx) {
				var operator = operators[operatorIdx];
				var found = false;
				for (var j = 0; j < opsUnderResolv.length; ++j) {
					if ( opsUnderResolv[j] == operator ) {
						found = true; break;
					}
				}
				if (found) { // the operator should be processed
					
					var leftOperand = operands[operatorIdx];
					if ( ! $.isFunction(leftOperand.evaluate) ) {
						leftOperand = new Expression(leftOperand);
					}
					
					var rightOperand = operands[operatorIdx + 1];
					if ( ! $.isFunction(rightOperand.evaluate) ) {
						rightOperand = new Expression(rightOperand);
					}
					
					operators.splice(operatorIdx, (operatorIdx == 0 ? 1 : operatorIdx)); // no comment
					operands.splice(operatorIdx + 1, operatorIdx + 1);
					
					(function(leftOperand, operator, rightOperand) {
						
						operands[operatorIdx] = new Expression(
						function( data ) {
								return Expression.binaryOpExecutors[operator]
									(leftOperand.evaluate(data), rightOperand.evaluate(data) )
							},
							leftOperand.dependencies.concat(rightOperand.dependencies)
						);
						
					})(leftOperand, operator, rightOperand);
					--operatorIdx;
				}
			}
			if (operators.length == 0) {
				break;
			}
		}
		return operands[0];
	};
	
	// keep the operators ordered descending by length
	Expression.binaryOperators = ['==', '=', '<=', '>=', '<', '>', 'or', 'and', '||', '&&', '+', '*', '/', '%'];
	
	Expression.binaryOpExecutors = {
		'==': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a == b;
		},
		'=': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a == b;
		},
		'<=': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a <= b;
		},
		'+': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a + b;
		},
		'-': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a - b;
		},
		'*': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a * b;
		},
		'/': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a / b;
		},
		'%': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a % b;
		},
		'and': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a && b;
		},
		'&&': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a && b;
		},
		'or': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a || b;
		},
		'||': function(a, b) {
			while ( $.isFunction(a) ) {
				a = a();
			};
			while ($.isFunction(b) ) {
				b = b();
			}
			return a || b;
		}
	};
	
	Expression.operatorPrecedence = [
		['*', '/', '%'],
		['+', '-'],
		['<=', '>=', '<', '>'],
		['==', '='],
		['and', '&&'],
		['or', '||']
	];
	
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
		Expression: Expression,
		readTree: readTree
	};
	
})(jQuery);
