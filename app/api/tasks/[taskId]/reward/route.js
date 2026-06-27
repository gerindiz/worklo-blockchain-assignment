const { NextRequest, NextResponse } = require('next/server');
const { ethers } = require('ethers');
const { Permission } = require('@/lib/permissions');
const { logger, apiCall, apiResponse, databaseQuery, databaseError } = require('@/lib/debug-logger');
const { requireAuthAndPermission, handleGuardError } = require('@/lib/server-guards');
const { createApiSupabaseClient, createAdminSupabaseClient } = require('@/lib/supabase-server');

const WPT_ABI = [
  'function mint(address to, uint256 amount) external',
  'function decimals() view returns (uint8)',
];

async function POST(request, { params }) {
  const startTime = Date.now();

  try {
    const { taskId } = await params;

    await requireAuthAndPermission(Permission.MANAGE_TASKS, {}, request);

    const supabase = createApiSupabaseClient(request);
    const adminClient = createAdminSupabaseClient();

    if (!supabase || !adminClient) {
      logger.error('Supabase not configured', { action: 'rewardTask' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    apiCall('POST', `/api/tasks/${taskId}/reward`, { action: 'rewardTask', taskId });

    databaseQuery('SELECT', 'tasks', { action: 'rewardTask', taskId });
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, name, status, tx_hash')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      logger.error('Task not found', {
        action: 'rewardTask',
        taskId,
        error: taskError?.message,
      });
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const completedStatuses = ['done', 'completed'];
    if (!completedStatuses.includes(task.status)) {
      return NextResponse.json(
        { error: 'Only completed tasks can be rewarded' },
        { status: 400 },
      );
    }

    if (task.tx_hash) {
      return NextResponse.json(
        { error: 'Task already rewarded', txHash: task.tx_hash },
        { status: 400 },
      );
    }

    const rpcUrl = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545';
    const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
    const contractAddress = process.env.WPT_CONTRACT_ADDRESS;
    const rewardRecipient = process.env.REWARD_RECIPIENT_ADDRESS;

    if (!ownerPrivateKey || !contractAddress || !rewardRecipient) {
      logger.error('Blockchain config missing', { action: 'rewardTask' });
      return NextResponse.json(
        { error: 'Blockchain configuration missing in .env.local' },
        { status: 500 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);
    const wptContract = new ethers.Contract(contractAddress, WPT_ABI, ownerWallet);

    const decimals = await wptContract.decimals();
    const rewardAmount = ethers.parseUnits('10', decimals);

    logger.info('Minting WPT reward', {
      action: 'rewardTask',
      taskId,
      recipient: rewardRecipient,
      amount: '10',
    });

    const tx = await wptContract.mint(rewardRecipient, rewardAmount);
    const receipt = await tx.wait();
    const txHash = receipt.hash;

    databaseQuery('UPDATE', 'tasks', { action: 'rewardTask', taskId });
    const { error: updateError } = await adminClient
      .from('tasks')
      .update({ tx_hash: txHash })
      .eq('id', taskId);

    if (updateError) {
      databaseError('UPDATE', 'tasks', updateError, { action: 'rewardTask', taskId });
      logger.error('Failed to save tx_hash', {
        action: 'rewardTask',
        taskId,
        error: updateError.message,
      });
    }

    const duration = Date.now() - startTime;
    apiResponse('POST', `/api/tasks/${taskId}/reward`, 200, {
      action: 'rewardTask',
      duration,
      taskId,
      txHash,
    });

    logger.info('Task rewarded successfully', {
      action: 'rewardTask',
      taskId,
      txHash,
      duration,
    });

    return NextResponse.json({ txHash });
  } catch (error) {
    logger.error(
      'Error rewarding task',
      { action: 'rewardTask', error: error?.message },
      error,
    );

    if (
      error?.code === 'NETWORK_ERROR' ||
      error?.code === 'CONNECTION_REFUSED' ||
      error?.message?.includes('ECONNREFUSED')
    ) {
      return NextResponse.json(
        { error: 'Hardhat node not reachable. Is `npx hardhat node` running?' },
        { status: 503 },
      );
    }

    return handleGuardError(error);
  }
}

exports.POST = POST;

