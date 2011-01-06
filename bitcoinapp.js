/* Because of the way JSONP works this codes assumes a global 
 * variable named 'app' pointing to the BitcoinApp() instance!
 *
 * <script type="text/javascript">
 *     var app = new BitcoinApp();
 *     app.init();
 * </script>
 */

function BitcoinApp() {
	this.bitcoin = false;
	this.account = "";
	this.balance;
	this.connected = false;
	this.refreshTimeout = false;
	this.dateFormat = "dd/mm/yyyy HH:MM";

	this.onGetBalance = function(balance) {
		$('#balance').text(balance.formatBTC());
		app.balance = balance;
	}

	this.onGetAddress = function(address) {
		var addressField = $('#address');
		if(addressField.text() != address)
			$('#address').text(address);
	}

	this.onConnect = function(info) {
		if(info.version) {
			app.connected = true;

			app.refreshAccount();

			$('#section_Settings').next().slideUp('fast');
			$('#accountInfo').slideDown('fast');
			$('#section_SendBTC').show();
			$('#section_TX').show().next().show();
			$('#serverInfo').show();
		}
	}

	this.onDisconnect = function() {
		app.connected = false;
		app.balance = false;

		$('#title').text("Bitcoin (not connected)");
		$('#accountInfo').slideUp('fast');
		$('#serverInfo').hide();
		$('#serverInfo table').children().remove();
		$('#section_SendBTC').hide().next().hide();
		$('#section_TX').hide().next().hide();
		$('#section_Settings').next().show();

		app.clearTransactions();
	}

	this.onGetInfo = function(info) {
		var sNetwork = "Bitcoin";
		if(info.testnet) {
			sNetwork = "Testnet";
		}

		$('#title').text(sNetwork + " on " + app.bitcoin.RPCHost);

		var serverInfo = $('#serverInfo table');

		serverInfo.children().remove();

		for (var key in info) {
			serverInfo.append('<tr><td>' + key.capitalize() + '</td><td class="right">' + info[key] + '</td></tr>');
		}
		$('#serverInfo tr:odd').addClass('odd');
	}

	this.onSendBTC = function(result, error) {
		if(error != null) {
			app.error(error.message);
			return;
		}
		var obj;
		obj	= setFormValue($('form#sendBTC'), "address", "");
		hideValidation(obj);

		obj = setFormValue($('form#sendBTC'), "amount", "");
		hideValidation(obj);

		app.notify("Bitcoins sent");
		app.refreshAccount();
	}

	this.onValidateAddressField = function(result) {
		var field = $('form#sendBTC input[name="address"]')

		if(result.isvalid && field.val() == result.address) 
			showValidation(field, true);
		else
			showValidation(field, false);
	}

	this.onListTransactions = function(transactions) {
		for (var key in transactions) 
			if (transactions[key].time == undefined)
				transactions[key].time = 0;

		transactions.sort(sortTransactions);

		app.clearTransactions();

		var txlistContainer = $('#txlist');

		if(txlistContainer.children('tbody').length == 0) 
			txlistContainer.append('<tbody />');

		var txlist = txlistContainer.children('tbody');


		for (var key in transactions) 
			app.addTransaction(txlist, transactions[key]);

		$('#txlist tbody tr:odd').addClass('odd');

		txlist.children('tr').click( function() {
					var txrow = $(this);
					var tx = JSON.parse(txrow.attr('txinfo'));
					alert(tx.address);
				});
	}

	this.clearTransactions = function() {
		$('#txlist tbody').children().remove();
	}

	this.addTransaction = function(txlist, tx) {
		var confirmations = tx.confirmations<10?tx.confirmations:'&#x2713;';

		var timestamp = new Date();
		timestamp.setTime (tx.time * 1000);

		var info = tx.category.capitalize();

		if(tx.address) 
			info += " " + tx.address;

		if(tx.otheraccount) 
			info += " " + tx.otheraccount;

		var txitem = $('<tr><td class="center">' + confirmations + '</td><td>' + timestamp.format(this.dateFormat) + '</td><td class="info">' + info + '</td><td class="' + (tx.amount<0?'debit':'credit') + ' right">' + tx.amount.formatBTC(true) + '</td></tr>');

		txitem.attr("txinfo", JSON.stringify(tx));

		if (tx.confirmations == 0) {
			txitem.addClass("unconfirmed");
		}

		txlist.append(txitem);
	}

	this.refreshAccount = function() {
		clearTimeout(this.refreshTimeout);

		if(!this.connected) {
			return;
		}

		this.refreshServerInfo();
		this.refreshBalance();
		this.refreshTransactions();
		this.refreshAddress();

		this.refreshTimeout = setTimeout("app.refreshAccount();", 1000);
	}

	this.refreshServerInfo = function() {
		this.bitcoin.getInfo(this.onGetInfo);
	}

	this.refreshTransactions = function() {
		this.bitcoin.listTransactions(this.onListTransactions, this.account);
	}

	this.refreshBalance = function() {
		this.bitcoin.getBalance(this.onGetBalance, this.account);
	}

	this.refreshAddress = function() {
		this.bitcoin.getAddress(this.onGetAddress, this.account);
	}

	this.connect = function(host, port, user, pass) {
		this.onDisconnect();
		this.notify("Connecting");
		this.bitcoin = new Bitcoin(host, port, user, pass);
		this.bitcoin.init();
		this.bitcoin.getInfo(this.onConnect);
	}

	this.error = function(msg) {
		$(window).humanMsg(msg);
	}

	this.notify = function(msg) {
		$(window).humanMsg(msg);
	}

	this.sendBTC = function(address, amount) {
		if(!this.connected) {
			return this.error("Not connected!");
		}

		if(address === "") {
			return this.error("Invalid bitcoin address");
		}

		amount = Math.round(amount*100)/100;
		var confString = "Send " + amount.formatBTC() + " to " + address + "?";

		if(confirm(confString)) {
			app.bitcoin.sendBTC(this.onSendBTC, this.account, '"' + address + '"', amount);
		}
	}

	this.addPrototypes = function() {
		String.prototype.capitalize = function() {
			    return this.charAt(0).toUpperCase() + this.slice(1);
		}

		Number.prototype.formatBTC = function(addSign) {
			var nf = new NumberFormat(this);
			nf.setPlaces(2);
			nf.setCurrency(true);
			nf.setCurrencyValue(" BTC");
			nf.setCurrencyPosition(nf.RIGHT_OUTSIDE);

			var s = nf.toFormatted();

			if(addSign && this > 0)
				s = "+" + s;

			return s;
		}
	}

	this.init = function() {
		this.addPrototypes();

		if(!this.connected) {
			$('#accountInfo').hide();

			$.getJSON('settings.json', function(data) {
						if(data) {
							var form = $('form#settingsServer');
							setFormValue(form, "host", data.host);
							setFormValue(form, "port", data.port);
							setFormValue(form, "user", data.user);
							setFormValue(form, "pass", data.pass);
						}
					});
			this.onDisconnect();
		}

		$('#disconnectButton').click( function() {
					app.onDisconnect();
					return false;
				});

		$('form#settingsServer').submit( function() {
					var host = getFormValue(this, "host");
					var port = getFormValue(this, "port");
					var user = getFormValue(this, "user");
					var pass = getFormValue(this, "pass");
					app.connect(host, port, user, pass);
					return false;
				});

		$('form#sendBTC input[name="address"]').change( function() {
					if($(this).val() === "") {
						hideValidation(this);
						return;
					}

					var address = $(this).val();

					app.bitcoin.validateAddress(app.onValidateAddressField, address); 
				});

		$('form#sendBTC input[name="amount"]').change( function() {
					if($(this).val() === "") {
						hideValidation(this);
						return;
					}

					var amount = $(this).val();

					if(amount > 0 && amount <= app.balance) 
						showValidation(this, true);
					else
						showValidation(this, false);
				});

		$('form#sendBTC').submit( function() {
					var address = getFormValue(this, "address");
					var amount = getFormValue(this, "amount");

					app.sendBTC(address, amount);
					return false;
				});
	}
}
