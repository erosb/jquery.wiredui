module("NodeController");
/**/
test("OutputNode creation", function() {
	
	var ctrl = $.wiredui.buildController("<div1><span>txt${txt}</span><p></p></div1>", {
		"var1": 1
	});
	
	same(1, ctrl.childNodes[0].childNodes[0].childNodes.length);
	same("#text", ctrl.childNodes[0].childNodes[0].childNodes[0].nodeName);
	same("txt", ctrl.childNodes[0].childNodes[0].childNodes[0].nodeValue);
	
	same(1, ctrl.childNodeControllers.length);
	var childCtrl = ctrl.childNodeControllers[0].nodeController;
	var pos = ctrl.childNodeControllers[0].position;
	same(1, pos.idx);
	same(ctrl.childNodes[0].childNodes[0], pos.parentElem);
	same(childCtrl.parentController, ctrl);
	
});
/**/
test("IfNode creation", function() {
	
	var ctrl = $.wiredui.buildController("<div1>{{if true}}beforeSpan<span>beforeOut${a}</span>afterSpan{{/if}}</div1>", {
		a: 'aa'
	});

	same(ctrl.childNodes.length, 1);
	same(ctrl.childNodes[0].nodeName, "div1")
	
	same(ctrl.childNodeControllers.length, 1);
	
	var ifCtrl = ctrl.childNodeControllers[0].nodeController;
	var ifPos = ctrl.childNodeControllers[0].position;
	
	same(ifPos.idx, 0);
	same(ifPos.parentElem, ctrl.childNodes[0])
	
	same(ifCtrl.childNodes.length, 3);
	same(ifCtrl.childNodes[0].nodeName, "#text");
	same(ifCtrl.childNodes[0].nodeValue, "beforeSpan");
	
	same(ifCtrl.childNodes[1].nodeName, "span");
	same(ifCtrl.childNodes[1].childNodes.length, 1);
	
	same(ifCtrl.childNodes[2].nodeName, "#text");
	same(ifCtrl.childNodes[2].nodeValue, "afterSpan");
	
	same(ifCtrl.childNodeControllers.length, 1);
	
	var outCtrl = ifCtrl.childNodeControllers[0].nodeController;
	var outPos = ifCtrl.childNodeControllers[0].position;
	
	same(outCtrl.parentController, ifCtrl);
	same(outPos.idx, 1);
	same(outPos.parentElem, ifCtrl.childNodes[1]);
});

test("ElseIf - Else data structure", function() {
	
	var ctrl = $.wiredui.buildController("<div1>{{if true}}<span>if</span>"
		+ "{{elseif true}}<span>elseif${elif}</span>"
		+ "{{else}}<span>else</span>{{/if}}</div1>");
		
	same(ctrl.childNodeControllers.length, 1);
	
	var ifCtrl = ctrl.childNodeControllers[0].nodeController;
	var ifPos = ctrl.childNodeControllers[0].position;
	
	same(ifCtrl.childNodes.length, 1);
	same(ifCtrl.childNodes[0].nodeName, "span");
	same(ifCtrl.childNodes[0].childNodes[0].nodeValue, "if");
	
	same(ifCtrl.elseIfNodes.length, 1);
	
	var elseIfCtrl = ifCtrl.elseIfNodes[0];
	same(elseIfCtrl.childNodes.length, 1);
	same(elseIfCtrl.childNodes[0].nodeName, "span");
	same(elseIfCtrl.childNodes[0].childNodes[0].nodeValue, "elseif");
	
	var elseIfOutCtrl = elseIfCtrl.childNodeControllers[0].nodeController;
	ok(elseIfOutCtrl instanceof $.wiredui.OutputNodeController);
	same(elseIfOutCtrl.outputVarName, "elif")
	
	var elseCtrl = ifCtrl.elseNode;
	same(elseCtrl.childNodes.length, 1);
	same(elseCtrl.childNodes[0].nodeName, "span");
	same(elseCtrl.childNodes[0].childNodes[0].nodeValue, "else");
	
});
