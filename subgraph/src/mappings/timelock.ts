import {
  CallScheduled,
  CallExecuted,
  Cancelled,
} from '../../generated/ResurgenceTimelockController/ResurgenceTimelockController'
import { log } from '@graphprotocol/graph-ts'

export function handleCallScheduled(event: CallScheduled): void {
  log.info('Timelock CallScheduled: id={}, target={}, delay={}', [
    event.params.id.toHexString(),
    event.params.target.toHexString(),
    event.params.delay.toString(),
  ])
}

export function handleCallExecuted(event: CallExecuted): void {
  log.info('Timelock CallExecuted: id={}, target={}', [
    event.params.id.toHexString(),
    event.params.target.toHexString(),
  ])
}

export function handleCancelled(event: Cancelled): void {
  log.info('Timelock Cancelled: id={}', [event.params.id.toHexString()])
}
