class DebtModel {
  final int debtId;
  final double initialAmount;
  final double currentBalance;
  final double totalPaid;
  final int paymentCount;
  final Map<String, dynamic>? lastPayment;
  final List<dynamic> paymentHistory;
  final DateTime lastUpdated;
  final String? updatedBy;
  final double livingStipendTotal;
  final double tuitionTotal;
  final double totalDebt;
  final List<Map<String, dynamic>> components;
  final List<Map<String, dynamic>> unpaidComponents;
  final List<Map<String, dynamic>> pendingRequests;
  final DateTime? nextDueDate;

  DebtModel({
    required this.debtId,
    required this.initialAmount,
    required this.currentBalance,
    required this.totalPaid,
    required this.paymentCount,
    this.lastPayment,
    required this.paymentHistory,
    required this.lastUpdated,
    this.updatedBy,
    this.livingStipendTotal = 0,
    this.tuitionTotal = 0,
    this.totalDebt = 0,
    this.components = const [],
    this.unpaidComponents = const [],
    this.pendingRequests = const [],
    this.nextDueDate,
  });

  factory DebtModel.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic value) {
      if (value == null) return 0;
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? 0;
      return 0;
    }

    int toInt(dynamic value) {
      if (value == null) return 0;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }

    return DebtModel(
      debtId: toInt(json['debt_id']),
      initialAmount: toDouble(json['initial_amount']),
      currentBalance: toDouble(json['current_balance']),
      totalPaid: toDouble(json['total_paid']),
      paymentCount: toInt(json['payment_count']),
      lastPayment: json['last_payment'] as Map<String, dynamic>?,
      paymentHistory: List.from(json['payment_history'] ?? []),
      lastUpdated: json['last_updated'] != null
          ? DateTime.parse(json['last_updated'] as String)
          : DateTime.now(),
      updatedBy: json['updated_by'] as String?,
      livingStipendTotal: toDouble(json['living_stipend_total']),
      tuitionTotal: toDouble(json['tuition_total']),
      totalDebt: toDouble(json['total_debt']),
      components: (json['components'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          const [],
      unpaidComponents: (json['unpaid_components'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          const [],
      pendingRequests: (json['pending_requests'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          const [],
      nextDueDate: json['next_due_date'] != null
          ? DateTime.parse(json['next_due_date'] as String)
          : null,
    );
  }
}
