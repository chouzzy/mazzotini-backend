import { InvestorProfile } from "@prisma/client";

class InvestorProfileEntity {
  id!: InvestorProfile["id"];
  userId!: InvestorProfile["userId"];
  riskTolerance!: InvestorProfile["riskTolerance"];
  investmentGoals!: InvestorProfile["investmentGoals"];
  investmentHorizon!: InvestorProfile["investmentHorizon"];
  monthlyIncome!: InvestorProfile["monthlyIncome"];
  netWorth!: InvestorProfile["netWorth"];
  investmentExperience!: InvestorProfile["investmentExperience"];
  preferredInvestmentTypes!: InvestorProfile["preferredInvestmentTypes"];
  otherInvestments!: InvestorProfile["otherInvestments"];
  createdAt!: InvestorProfile["createdAt"];
  updatedAt!: InvestorProfile["updatedAt"];
}

export { InvestorProfileEntity };