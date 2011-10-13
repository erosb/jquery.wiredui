function debug(str) {
	console.log(str);
}

function tokens(str) {
	var stream = new $.binddata.TokenStream(str);
	return stream.readAll();
}

test("trim test", function() {
	same(new String(" a ").replace(/\s+$/, '').replace(/^\s+/, ''), "a")
})

module("TokenStream");

test("Reading plain HTML", function(){
	var stream = new $.binddata.TokenStream("foo<bar/>");
	var tokens = stream.readAll();
	same(tokens, [{
		type: 'html',
		token: "foo<bar/>"
	}], "one HTML token returned");
});
	
test("Properly handling special chars in HTML context", function()  {
	var a = tokens("f}o<o$ ba{r{");
	same(a, [{
		type: 'html',
		token: "f}o<o$ ba{r{"
	}], "properly handled");
});

test("Output token reading", function() {
	var a = tokens("${a}");
	same(a, [{
		type: 'output',
		token: "a"
	}], "single token reading works");
	a = tokens("${a}html");
	same(a, [{
		type: 'output',
		token: 'a'
	}, {
		type: 'html',
		token: 'html'
	}], "output > html");
	a = tokens("h1${a}h2${bb}");
	same(a, [{
		type: 'html',
		token: 'h1'
	}, {
		type: 'output',
		token: 'a'
	}, {
		type: 'html',
		token: 'h2'
	}, {
		type: 'output',
		token: 'bb'
	}], "html > output > html > output");
});


test("Statement token reading", function() {
	var a = tokens("{{foo bar}}");
	same(a, [{
		type: 'stmt',
		token: 'foo bar'
	}], "testing single token reading");
	
	a = tokens("{{foo < bar.user}} hey");
	same(a, [{
		type: 'stmt',
		token: 'foo < bar.user'
	}, {
		type: 'html',
		token: ' hey'
	}], "stmt > html");
	
	a = tokens("hooray {{foo < bar.user}} hey{{ aa }}");
	same(a, [{
		type: 'html',
		token: 'hooray '
	}, {
		type: 'stmt',
		token: 'foo < bar.user'
	}, {
		type: 'html',
		token: ' hey'
	}, {
		type: 'stmt',
		token: 'aa'
	}], "html > stmt > html > stmt");
});


module("Expressions");

test("literals", function() {
	var expr = new $.binddata.Expression(" (null ) ");
	same(null, expr.evaluate(), "null works");
	expr = new $.binddata.Expression(" 'hey'");
	same('hey', expr.evaluate(), "''string works");
	expr = new $.binddata.Expression(' "hey" ');
	same('hey', expr.evaluate(), '"" string works');
	
	expr = new $.binddata.Expression("-2.45");
	same(-2.45, expr.evaluate(), "number works");
	
	expr = new $.binddata.Expression("true");
	same(true, expr.evaluate(), "boolean true works");
	
	expr = new $.binddata.Expression("false");
	same(false, expr.evaluate(), "boolean false works");
})

test("variables", function() {
	var data = $.observable({myvar: 'myval'});
	var expr = new $.binddata.Expression("myvar");
	
	data().myvar("changed");
	same('changed', expr.evaluate(data)(), "simple variable")
	
	data = $.observable({
		myobj: {
			mystr: "hey"
		}
	});
	expr = new $.binddata.Expression("myobj.mystr");
	same('hey', expr.evaluate(data)(), "object property");
	
	expr = new $.binddata.Expression("non.exis.tent");
	same(undefined, expr.evaluate(data), "handling non-existent property correctly");
})
