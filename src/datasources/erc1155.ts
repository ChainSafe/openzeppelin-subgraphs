import {
	ethereum,
	BigInt,
} from '@graphprotocol/graph-ts'

import {
	Account,
	ERC1155Contract,
	ERC1155Transfer,
} from '../../generated/schema'

import {
	IERC1155,
	ApprovalForAll as ApprovalForAllEvent,
	TransferBatch  as TransferBatchEvent,
	TransferSingle as TransferSingleEvent,
	URI            as URIEvent,
} from '../../generated/erc1155/IERC1155'

import {
	constants,
	decimals,
	events,
	transactions,
} from '@amxx/graphprotocol-utils'

import {
	fetchAccount,
} from '../fetch/account'

import {
	fetchERC1155,
	fetchERC1155Token,
	fetchERC1155Balance,
	fetchERC721Operator,
} from '../fetch/erc1155'

function registerTransfer(
	event:    ethereum.Event,
	suffix:   string,
	contract: ERC1155Contract,
	operator: Account,
	from:     Account,
	to:       Account,
	id:       BigInt,
	value:    BigInt)
: void
{
	let token = fetchERC1155Token(contract, id)
	let ev = new ERC1155Transfer(events.id(event).concat(suffix))
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.contract    = contract.id
	ev.token       = token.id
	ev.operator    = operator.id
	ev.from        = from.id
	ev.to          = to.id
	ev.value       = decimals.toDecimals(value)
	ev.valueExact  = value

	if (from.id == constants.ADDRESS_ZERO) {
		let totalSupply        = fetchERC1155Balance(token, null)
		let totalSupplyValue   = new decimals.Value(totalSupply.value)
		totalSupplyValue.increment(value)
		totalSupply.valueExact = totalSupplyValue.exact
		totalSupply.save()
	} else {
		let balance            = fetchERC1155Balance(token, from)
		let balanceValue       = new decimals.Value(balance.value)
		balanceValue.decrement(value)
		balance.valueExact     = balanceValue.exact
		balance.save()
		ev.fromBalance         = balance.id
	}

	if (to.id == constants.ADDRESS_ZERO) {
		let totalSupply        = fetchERC1155Balance(token, null)
		let totalSupplyValue   = new decimals.Value(totalSupply.value)
		totalSupplyValue.decrement(value)
		totalSupply.valueExact = totalSupplyValue.exact
		totalSupply.save()
	} else {
		let balance            = fetchERC1155Balance(token, to)
		let balanceValue       = new decimals.Value(balance.value)
		balanceValue.increment(value)
		balance.valueExact     = balanceValue.exact
		balance.save()
		ev.toBalance           = balance.id
	}

	token.save()
	ev.save()
}

export function handleTransferSingle(event: TransferSingleEvent): void
{
	let contract = fetchERC1155(event.address)
	let operator = fetchAccount(event.params.operator)
	let from     = fetchAccount(event.params.from)
	let to       = fetchAccount(event.params.to)

	registerTransfer(
		event,
		"",
		contract,
		operator,
		from,
		to,
		event.params.id,
		event.params.value
	)
}

export function handleTransferBatch(event: TransferBatchEvent): void
{
	let contract = fetchERC1155(event.address)
	let operator = fetchAccount(event.params.operator)
	let from     = fetchAccount(event.params.from)
	let to       = fetchAccount(event.params.to)

	let ids    = event.params.ids
	let values = event.params.values
	for (let i = 0;  i < ids.length; ++i)
	{
		registerTransfer(
			event,
			"/".concat(i.toString()),
			contract,
			operator,
			from,
			to,
			ids[i],
			values[i]
		)
	}
}

export function handleApprovalForAll(event: ApprovalForAllEvent): void {
	let contract         = fetchERC1155(event.address)
	let owner            = fetchAccount(event.params.account)
	let operator         = fetchAccount(event.params.operator)
	let delegation       = fetchERC721Operator(contract, owner, operator)
	delegation.approved  = event.params.approved
	delegation.save()
}

export function handleURI(event: URIEvent): void
{
	let contract = fetchERC1155(event.address)
	let token    = fetchERC1155Token(contract, event.params.id)
	token.uri    = event.params.value
	token.save()
}
