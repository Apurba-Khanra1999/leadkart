DROP POLICY IF EXISTS record_products_insert ON public.record_products;
DROP POLICY IF EXISTS record_products_update ON public.record_products;
DROP POLICY IF EXISTS record_products_delete ON public.record_products;

CREATE POLICY record_products_insert
ON public.record_products
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_member(organization_id)
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
      AND p.organization_id = organization_id
  )
  AND (
    (
      lead_id IS NOT NULL
      AND follow_up_id IS NULL
      AND public.has_perm(organization_id, 'leads.update')
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
          AND l.organization_id = organization_id
      )
    )
    OR
    (
      follow_up_id IS NOT NULL
      AND lead_id IS NULL
      AND public.has_perm(organization_id, 'followups.manage')
      AND EXISTS (
        SELECT 1 FROM public.follow_ups f
        WHERE f.id = follow_up_id
          AND f.organization_id = organization_id
      )
    )
  )
);

CREATE POLICY record_products_update
ON public.record_products
FOR UPDATE
TO authenticated
USING (
  public.is_org_member(organization_id)
  AND (
    (lead_id IS NOT NULL AND public.has_perm(organization_id, 'leads.update'))
    OR (follow_up_id IS NOT NULL AND public.has_perm(organization_id, 'followups.manage'))
  )
)
WITH CHECK (
  public.is_org_member(organization_id)
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
      AND p.organization_id = organization_id
  )
  AND (
    (
      lead_id IS NOT NULL
      AND follow_up_id IS NULL
      AND public.has_perm(organization_id, 'leads.update')
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_id
          AND l.organization_id = organization_id
      )
    )
    OR
    (
      follow_up_id IS NOT NULL
      AND lead_id IS NULL
      AND public.has_perm(organization_id, 'followups.manage')
      AND EXISTS (
        SELECT 1 FROM public.follow_ups f
        WHERE f.id = follow_up_id
          AND f.organization_id = organization_id
      )
    )
  )
);

CREATE POLICY record_products_delete
ON public.record_products
FOR DELETE
TO authenticated
USING (
  public.is_org_member(organization_id)
  AND (
    (lead_id IS NOT NULL AND public.has_perm(organization_id, 'leads.update'))
    OR (follow_up_id IS NOT NULL AND public.has_perm(organization_id, 'followups.manage'))
  )
);