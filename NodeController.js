(function($) {

    var NodeController = $.wiredui.NodeController = function NodeController(varCtx) {
		this.initNode(varCtx);
		
		/** $.wiredui.NodeController */
		this.parentController = null;
	};
	
	NodeController.prototype.initNode = function(varCtx) {
		this.varCtx = varCtx;
		
		this.childNodes = [];
		
		this.childNodeControllers = [];
		
		this.readDepth = 0;
		
		/** $.wiredui.DOMIterator */
		this.iterator = null;
		
		
		this.parentStack = [ this ];
		
		this.currentParent = this;
	}
	
	NodeController.prototype.setupListeners = function(deps) {
		var self = this;
		var reRender = function() {
			self.parentController.update(self);
		}
		for (var i = 0; i < deps.length; ++i) {
			var depChain = deps[i];
			
			var prevFn = function(){};
			for (var j = depChain.length - 1; j >= 0; --j) {
				var prevFnFn = prevFn;
				var fn = (function(jj) {
					
					return function(data) {
						if ( $.isFunction(data()[ depChain[jj] ] ) ) {
							var subFn = function(newVal){
								prevFnFn(newVal);
								reRender()							
							};
							data()[ depChain[jj] ].on("change", subFn );
							prevFnFn(data()[ depChain[jj] ] );
						}
					};
					
				})(j);
				prevFn = fn;
			}
			prevFn(this.varCtx.data);
		}
	}
	
	NodeController.prototype.startElem = function(elem) {
		++this.readDepth;
		if (elem.nodeName === "#text") {
			this.readTextElem(elem.nodeValue);
		} else {
			var newElem = elem.cloneNode();
			
			// cleaning the child nodes - it will be re-populated by subsequent startElem() calls
			while (newElem.childNodes.length > 0) {
				newElem.removeChild(newElem.childNodes[0]);
			}
			
			this.currentParent.appendChild(newElem);
			
			this.parentStack.push(this.currentParent);
			this.currentParent = newElem;
		}
	};
	
	NodeController.prototype.appendChild = function(child) {
		this.childNodes.push(child);
	};
	
	NodeController.prototype.readTextElem = function(str) {
		var parser = this.parser = new $.wiredui.TextElemParser(str);
		var token = null;
		while ( (token = parser.read()) !== null) {
			// console.log(token);
			switch(token.type) {
				case "output":
					var childNodeCtrl = new $.wiredui.ChildNodeController();
					var pos = new $.wiredui.ElemPosition();
					pos.idx = this.currentParent.childNodes.length;
					pos.parentElem = this.currentParent;
					childNodeCtrl.position = pos;
					childNodeCtrl.nodeController = new $.wiredui.OutputNodeController(this.varCtx
						, this
						, token.token);
					this.childNodeControllers.push(childNodeCtrl);
					break;
				case "stmt":
					var nodeController = this.createChildNodeController(token.token);
					if (nodeController !== null) {
						// console.log("switching listener at "+token.token);
						// console.log(nodeController);
						this.iterator.listener = nodeController;
						this.iterator.pushTextNode(parser.getUnread());
					}
					break;
				case "html":
					this.currentParent.appendChild(document.createTextNode(token.token));
					break;
			}
		}
		this.parser = null;
	}
	
	NodeController.prototype.createChildNodeController = function(str) {
		var childNodeCtrl = new $.wiredui.ChildNodeController();
		var pos = new $.wiredui.ElemPosition();
		pos.idx = this.currentParent.childNodes.length;
		pos.parentElem = this.currentParent;
		childNodeCtrl.position = pos;
		var nodeController = childNodeCtrl.nodeController = this.createStatementController(str);
		if (nodeController !== null) {
			if (nodeController !== this.parentController) {
				if (nodeController instanceof $.wiredui.ElseIfNodeController) {
					$.wiredui.IfNodeController.appendElseIf(nodeController);
				} else if (nodeController instanceof $.wiredui.ElseNodeController) {
					$.wiredui.IfNodeController.appendElse(nodeController);
				} else {
					this.childNodeControllers.push(childNodeCtrl);
				}
			}
			return nodeController;
		}
		return null;
	};
	
	/**
	 * Helper function to explode the command name (string part before the first space)
	 * and the command-specific parts.
	 * 
	 * @usedby NodeController.prototype.createStatementController()
	 * @usedby IfNodeController.prototype.createStatementController()
	 * 
	 */
	NodeController.stmtParts = function(str) {
		var firstSpacePos = str.indexOf(" ");
		if (firstSpacePos == -1) {
			var stmtWord = str;
			var remaining = "";
		} else {
			var stmtWord = str.substr(0, firstSpacePos);
			var remaining = str.substr(firstSpacePos);
		}
		return {
			"stmtWord" : stmtWord,
			"remaining": remaining
		};
	}
	
	NodeController.prototype.createStatementController = function(str) {
		var rval = null;
		stmtParts = NodeController.stmtParts(str);
		var stmtWord = stmtParts.stmtWord;
		var remaining = stmtParts.remaining;
		var varCtx = this.varCtx;
		switch( stmtWord ) {
			case 'if':
				rval = new $.wiredui.IfNodeController(this.varCtx, this, remaining);
				break;
			case 'elseif':
			case 'elif':
			case 'elsif':
				rval = new $.wiredui.ElseIfNodeController(this.varCtx, this, remaining);
				break;
			case 'else':
				rval = new $.wiredui.ElseNodeController(this.varCtx, this, remaining);
				break;
			case 'each':
				rval = new $.wiredui.EachNodeController(this.varCtx, this, remaining);
				break;
			default:
				throw "invalid statement tag '" + str + "'";
		}
		rval.iterator = this.iterator;
		rval.parentController = this;
		return rval;
	};
	
	NodeController.prototype.finishElem = function(elem) {
		if (elem.nodeName == "#text")
			// not much to do here
			return;
			
		if (this.parentStack.length == 0)
			throw "failed finishElem " + elem.nodeName + ": no opened elem";
		
		this.currentParent = this.parentStack.pop();
		
		/*if (this.parentStack.length == 0) {
			this.iterator.listener = this.parentController;
			console.log("setting listener to parentController:")
			console.log(this.parentController)
		}*/
	}
	
	var appendAtPosition = function(parentNode, childNodes, idx) {
		
	}
	
	NodeController.prototype.render = function() {
		// wrapping the result into a div
		var rval = document.createElement("div");
		for(var i = 0; i < this.childNodes.length; ++i) {
			rval.appendChild(this.childNodes[i]);
		}
		var idxShift = 0;
		for (i = 0; i < this.childNodeControllers.length; ++i) {
			var pos = this.childNodeControllers[i].position;
			var ctrl = this.childNodeControllers[i].nodeController;
			
			var nodeStack = document.createElement("div");
			
			for(var j = pos.idx + idxShift; j < pos.parentElem.childNodes.length; ++j) {
				nodeStack.appendChild(pos.parentElem.childNodes[i]);
			}
			
			var ctrlDOM = this.childNodeControllers[i].lastCreatedElems = ctrl.render();
			for (j = 0; j < ctrlDOM.length; ++j) {
				pos.parentElem.appendChild(ctrlDOM[j]);
			}
			
			for (j = 0; j < nodeStack.childNodes.length; ++j) {
				pos.parentElem.appendChild(nodeStack.childNodes[j]);
			}
			idxShift += nodeStack.childNodes.length;
		}
		return rval.childNodes;
	}
	
	NodeController.prototype.getElemPositionByCtrl = function(ctrl) {
		for (var i = 0; i < this.childNodeControllers.length; ++i) {
			if (this.childNodeControllers[i].nodeController === ctrl) {
				return this.childNodeControllers[i].position;
			}
		}
		throw "childNodeController not found";
	}
	
	NodeController.prototype.update = function(childCtrl) {
		var pos = this.getElemPositionByCtrl(childCtrl);
		console.log(pos.idx)
		
	}

})(jQuery);
