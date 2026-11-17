// Enable JSON.stringify to natively handle BigInt fields
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

