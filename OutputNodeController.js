(function($) {
	
	var OutputNodeController = $.wiredui.OutputNodeController = function(varCtx, parentController, token) {
		this.parentController = parentController;
		this.outputVarName = token;
		this.initNode(varCtx);
	};
	
	OutputNodeController.prototype = new $.wiredui.NodeController();
	
	OutputNodeController.prototype.render = function() {
		return [document.createTextNode( this.varCtx.getValue(this.outputVarName)() )];
	}
	
	
	
})(jQuery);
