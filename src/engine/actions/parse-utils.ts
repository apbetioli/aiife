/** Split "the X, the Y and the Z" into ["X", "Y", "Z"], stripping articles. */
export function splitItemList(raw: string): string[] {
	return raw
		.split(/\s*(?:,\s*(?:and\s+)?|(?:^|,?\s+)and\s+)\s*/i)
		.map((s) => s.replace(/^(?:the|a|an)\s+/i, "").trim())
		.filter(Boolean);
}
