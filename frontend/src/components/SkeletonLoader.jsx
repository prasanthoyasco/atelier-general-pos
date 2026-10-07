import React from "react";

// Card Skeleton for POS page items catalogue
export const POSCatalogueSkeleton = ({ cards = 10 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 w-full animate-pulse">
    {Array.from({ length: cards }).map((_, i) => (
      <div key={i} className="border border-slate-100 rounded-xl p-4 flex flex-col items-center bg-white shadow-sm space-y-3 select-none">
        <div className="w-16 h-16 rounded-full bg-slate-200 mt-4 mb-3 shrink-0 animate-pulse"></div>
        <div className="h-4 bg-slate-200 rounded w-3/4 mb-1"></div>
        <div className="h-3.5 bg-slate-200 rounded w-1/2"></div>
      </div>
    ))}
  </div>
);

// List/Row skeleton for general tables/lists
export const ListSkeleton = ({ rows = 5 }) => (
  <div className="w-full space-y-3 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-4 flex-1">
          <div className="rounded-lg bg-slate-200 h-10 w-10 shrink-0"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-3 bg-slate-200 rounded w-1/4"></div>
          </div>
        </div>
        <div className="h-6 bg-slate-200 rounded w-16"></div>
      </div>
    ))}
  </div>
);

// Table Skeleton for simple listings
export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="w-full border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm animate-pulse">
    <div className="bg-slate-50 p-4 border-b border-slate-100 flex gap-4">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-200 rounded flex-1"></div>
      ))}
    </div>
    <div className="p-4 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-slate-100 rounded flex-1"></div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Statistics + Table Skeleton for reports (SalesReport & SourceWiseReport)
export const ReportSkeleton = () => (
  <div className="space-y-6 w-full animate-pulse">
    {/* Summary Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-7 bg-slate-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
    {/* Table Area */}
    <TableSkeleton rows={5} cols={5} />
  </div>
);

// Employee Overview skeleton loader
export const EmployeeOverviewSkeleton = () => (
  <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6 animate-pulse">
    {/* Profile Card */}
    <div className="flex items-center space-x-4">
      <div className="w-16 h-16 rounded-full bg-slate-200"></div>
      <div className="space-y-2 flex-1">
        <div className="h-5 bg-slate-200 rounded w-1/2"></div>
        <div className="h-3.5 bg-slate-200 rounded w-1/3"></div>
      </div>
    </div>
    {/* Middle content blocks */}
    <div className="space-y-3.5 pt-2">
      <div className="h-14 bg-slate-50 border border-slate-100 rounded-2xl"></div>
      <div className="h-14 bg-slate-50 border border-slate-100 rounded-2xl"></div>
    </div>
    {/* Action buttons */}
    <div className="flex gap-3 pt-2">
      <div className="h-11 bg-slate-200 rounded-xl flex-1"></div>
      <div className="h-11 bg-slate-200 rounded-xl flex-1"></div>
    </div>
  </div>
);
